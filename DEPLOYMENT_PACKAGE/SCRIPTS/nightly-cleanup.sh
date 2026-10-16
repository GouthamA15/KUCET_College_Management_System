#!/usr/bin/env bash
# =============================================================================
# KUCET CMS — Production Automated Nightly Cleanup Script
# File: DEPLOYMENT_PACKAGE/SCRIPTS/nightly-cleanup.sh
#
# Runs daily around 00:00 (Midnight) Asia/Kolkata (IST).
#
# PURPOSE:
#   Safely reclaims disk space on the self-hosted production server by pruning
#   strictly disposable temporary data:
#     1. Stale Docker build cache (>7 days old)
#     2. Dangling untagged Docker images (>7 days old)
#     3. Disposable stopped Docker containers (>48 hours old)
#     4. Archived systemd journal logs (>14 days old, capped at 500 MB)
#     5. Superseded APT package archives (autoclean)
#     6. Stale deployment/rollback logs (>14 days old in /var/log/kucet)
#     7. Safe, allowlisted OS temporary files (>7 days old in /tmp)
#
# INVIOLABLE SAFETY GUARDS:
#   - NEVER touches persistent storage (/var/www/kucet-storage)
#   - NEVER touches database backups (/var/kucet-db-backup)
#   - NEVER prunes Docker named volumes (db-data, redis-data, uptime-kuma-data)
#   - NEVER runs unconstrained wildcards or recursive deletions on root paths
#   - NEVER deletes active production containers, networks, or tagged images
#   - NEVER touches active production logs (monitor.log, backup.log, etc.)
#   - NEVER runs if deployment, rollback, or database backup locks are held
#   - Aborts immediately if pre-flight production health check fails
#   - Verifies system integrity, DB, Redis, and storage post-cleanup
#
# USAGE:
#   sudo bash nightly-cleanup.sh             # Execute live cleanup
#   sudo bash nightly-cleanup.sh --dry-run   # Preview cleanup without deleting
#
# EXIT CODES:
#   0 - Success or safely skipped
#   1 - Pre-flight health check failure or fatal execution error
# =============================================================================

set -eu
set -o pipefail 2>/dev/null || true

# ---------------------------------------------------------------------------
# Script Configuration & Paths
# ---------------------------------------------------------------------------
SCRIPT_NAME="nightly-cleanup"
KUCET_CMS_DIR="${KUCET_CMS_DIR:-/var/www/kucet-cms}"
SCRIPTS_DIR="$KUCET_CMS_DIR/DEPLOYMENT_PACKAGE/SCRIPTS"
HEALTH_CHECK_SCRIPT="$SCRIPTS_DIR/health-check.sh"
LOG_DIR="/var/log/kucet"
LOG_FILE="$LOG_DIR/nightly-cleanup.log"

# Protected Paths (Explicit Safety Checks)
STORAGE_DIR="/var/www/kucet-storage"
BACKUP_DIR="/var/kucet-db-backup"

# Concurrency & Inter-process Locks
CLEANUP_LOCK_FILE="/tmp/kucet_cleanup.lock"
DEPLOY_LOCK_FILE="/tmp/kucet_deploy.lock"
BACKUP_LOCK_FILE="$BACKUP_DIR/.backup.lock"
ROLLBACK_COOLDOWN_FILE="/tmp/kucet_rollback_cooldown"

# Retention Policies (Explicit Rationale)
# Docker build cache older than 7 days (168h): allows warm cache for recent builds/rollbacks
DOCKER_BUILD_CACHE_UNTIL="168h"
# Docker dangling images older than 7 days (168h): intermediate untagged layers no longer referenced
DOCKER_DANGLING_IMAGE_UNTIL="168h"
# Stopped containers older than 48 hours (48h): one-off debugging containers that have exited
DOCKER_CONTAINER_UNTIL="48h"
# Systemd journal archive retention: 14 days and max 500MB (active journals always preserved)
JOURNAL_VACUUM_TIME="14d"
JOURNAL_VACUUM_SIZE="500M"
# Deployment/rollback log files in /var/log/kucet: 14 days (matches logrotate policy)
LOG_RETENTION_DAYS=14
# Allowlisted /tmp scratch files: 7 days
TMP_RETENTION_DAYS=7

# Operational Flags
DRY_RUN=false

# Parse Command-Line Options
for arg in "$@"; do
  case "$arg" in
    --dry-run|-n)
      DRY_RUN=true
      ;;
    --help|-h)
      echo "KUCET CMS — Production Automated Nightly Cleanup"
      echo ""
      echo "Usage:"
      echo "  sudo bash $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --dry-run, -n    Preview disposable candidates without deleting"
      echo "  --help, -h       Display this help message and exit"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Usage: sudo bash $0 [--dry-run]"
      exit 1
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Logging Functions
# ---------------------------------------------------------------------------
mkdir -p "$LOG_DIR" 2>/dev/null || true
touch "$LOG_FILE" 2>/dev/null || true

log() {
  local timestamp
  timestamp="$(date '+%Y-%m-%d %H:%M:%S %Z')"
  local msg="[$timestamp] [CLEANUP] $*"
  if [[ -n "${INVOCATION_ID:-}" ]]; then
    # Running under systemd unit where StandardOutput is already appended to $LOG_FILE
    echo "$msg"
  else
    # Running interactively or from cron
    echo "$msg" | tee -a "$LOG_FILE" 2>/dev/null || echo "$msg"
  fi
}

log_dry() {
  local candidate="$1"
  local reason="$2"
  local action="$3"
  local est_size="${4:-Unknown}"
  log "[DRY-RUN] Candidate: $candidate"
  log "          Reason   : $reason"
  log "          Action   : $action"
  log "          Est Size : $est_size"
}

# ---------------------------------------------------------------------------
# Format Bytes Helper
# ---------------------------------------------------------------------------
format_bytes() {
  local b="${1:-0}"
  if [[ "$b" -ge 1073741824 ]]; then
    awk -v b="$b" 'BEGIN { printf "%.2f GB", b / 1073741824 }'
  elif [[ "$b" -ge 1048576 ]]; then
    awk -v b="$b" 'BEGIN { printf "%.2f MB", b / 1048576 }'
  elif [[ "$b" -ge 1024 ]]; then
    awk -v b="$b" 'BEGIN { printf "%.2f KB", b / 1024 }'
  else
    echo "${b} B"
  fi
}

# ---------------------------------------------------------------------------
# 1. Concurrency & Inter-Service Conflict Guards
# ---------------------------------------------------------------------------
acquire_lock() {
  log "Verifying process concurrency and lock status ..."

  # 1a. Ensure only one cleanup runs at a time
  exec 201>"$CLEANUP_LOCK_FILE"
  if ! flock -n 201; then
    log "NOTICE: Another cleanup process is already active. Exiting safely."
    exit 0
  fi

  # 1b. Check if deployment is currently active
  if [[ -f "$DEPLOY_LOCK_FILE" ]]; then
    # Try non-blocking flock on deploy lock descriptor
    if ! (exec 200<"$DEPLOY_LOCK_FILE"; flock -n 200) 2>/dev/null; then
      log "WARNING: Deployment is currently active (holding $DEPLOY_LOCK_FILE). Skipping cleanup."
      exit 0
    fi
  fi

  # 1c. Check if database backup is currently active
  if [[ -f "$BACKUP_LOCK_FILE" ]]; then
    local lock_age=0
    lock_age=$(( $(date +%s) - $(stat -c %Y "$BACKUP_LOCK_FILE" 2>/dev/null || echo 0) ))
    if [[ "$lock_age" -lt 900 ]]; then
      log "WARNING: Database backup is currently in progress (lock age: ${lock_age}s). Skipping cleanup."
      exit 0
    fi
  fi

  # 1d. Check if rollback cooldown is active (<300s)
  if [[ -f "$ROLLBACK_COOLDOWN_FILE" ]]; then
    local cooldown_age=0
    cooldown_age=$(( $(date +%s) - $(stat -c %Y "$ROLLBACK_COOLDOWN_FILE" 2>/dev/null || echo 0) ))
    if [[ "$cooldown_age" -lt 300 ]]; then
      log "WARNING: System is in post-rollback cooldown window (${cooldown_age}s ago). Skipping cleanup."
      exit 0
    fi
  fi

  log "Locks acquired. Zero concurrent deployment, backup, or rollback activities."
}

# ---------------------------------------------------------------------------
# 2. Pre-Flight Production Health Checks
# ---------------------------------------------------------------------------
preflight_health_check() {
  log "Executing pre-flight production health verification ..."

  # Check Docker daemon
  if ! docker info >/dev/null 2>&1; then
    log "CRITICAL ERROR: Docker daemon is not responding! Skipping cleanup to prevent system instability."
    exit 1
  fi

  # Check critical production containers are running
  local required_containers=("kucet-cms-app" "kucet-cms-realtime" "kucet-cms-redis" "kucet-cms-db" "kucet-cms-proxy")
  for c in "${required_containers[@]}"; do
    if ! docker ps --format '{{.Names}}' | grep -q "^${c}$"; then
      log "CRITICAL ERROR: Production container '$c' is NOT running! Skipping cleanup to avoid exacerbating incident."
      exit 1
    fi
  done

  # Check MySQL connectivity
  if ! docker exec kucet-cms-db mysqladmin ping -h localhost >/dev/null 2>&1; then
    log "CRITICAL ERROR: MySQL container is unreachable via mysqladmin! Skipping cleanup."
    exit 1
  fi

  # Check Redis connectivity
  if ! docker exec kucet-cms-redis redis-cli ping | grep -q "PONG" 2>/dev/null; then
    log "CRITICAL ERROR: Redis container is unreachable! Skipping cleanup."
    exit 1
  fi

  # Check Next.js health endpoint
  local health_code
  health_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:3000/api/health" 2>/dev/null || echo "000")
  if [[ "$health_code" -ne 200 ]]; then
    log "CRITICAL ERROR: Application health endpoint returned HTTP $health_code (expected 200). Skipping cleanup."
    exit 1
  fi

  log "Pre-flight health check PASSED: Core containers, MySQL, Redis, and App are healthy."
}

# ---------------------------------------------------------------------------
# 3. Targeted Cleanup Categories
# ---------------------------------------------------------------------------

# Category A: Docker Build Cache
cleanup_docker_build_cache() {
  log "--- [CATEGORY A: DOCKER BUILD CACHE] ---"
  local filter_str="until=${DOCKER_BUILD_CACHE_UNTIL}"

  if $DRY_RUN; then
    log_dry "Docker BuildKit Cache" "Layers older than $DOCKER_BUILD_CACHE_UNTIL" "PRUNE (docker builder prune --filter $filter_str)"
  else
    log "Pruning Docker BuildKit cache older than $DOCKER_BUILD_CACHE_UNTIL ..."
    local prune_out
    prune_out=$(docker builder prune -f --filter "$filter_str" 2>&1 || true)
    log "Docker builder prune result: $(echo "$prune_out" | tail -n 2 | tr '\n' ' ')"
  fi
}

# Category B: Docker Dangling Images
cleanup_docker_dangling_images() {
  log "--- [CATEGORY B: DOCKER DANGLING IMAGES] ---"
  local filter_str="until=${DOCKER_DANGLING_IMAGE_UNTIL}"
  local dangling_ids
  dangling_ids=$(docker images -f "dangling=true" -f "$filter_str" -q 2>/dev/null || true)

  if [[ -z "$dangling_ids" ]]; then
    log "No dangling images older than $DOCKER_DANGLING_IMAGE_UNTIL found."
    return
  fi

  local count
  count=$(echo "$dangling_ids" | wc -l)

  if $DRY_RUN; then
    log_dry "$count dangling images" "Untagged layers older than $DOCKER_DANGLING_IMAGE_UNTIL" "PRUNE (docker image prune --filter $filter_str)"
  else
    log "Pruning $count dangling images older than $DOCKER_DANGLING_IMAGE_UNTIL ..."
    local prune_out
    prune_out=$(docker image prune -f --filter "$filter_str" 2>&1 || true)
    log "Docker image prune result: $(echo "$prune_out" | tail -n 2 | tr '\n' ' ')"
  fi
}

# Category C: Stopped Disposable Docker Containers
cleanup_docker_stopped_containers() {
  log "--- [CATEGORY C: STOPPED DOCKER CONTAINERS] ---"
  local filter_str="until=${DOCKER_CONTAINER_UNTIL}"
  local stopped_ids
  stopped_ids=$(docker ps -a -f "status=exited" -f "status=dead" -f "$filter_str" -q 2>/dev/null || true)

  if [[ -z "$stopped_ids" ]]; then
    log "No stopped/dead containers older than $DOCKER_CONTAINER_UNTIL found."
    return
  fi

  local count
  count=$(echo "$stopped_ids" | wc -l)

  if $DRY_RUN; then
    log_dry "$count stopped containers" "Exited/dead containers older than $DOCKER_CONTAINER_UNTIL" "PRUNE (docker container prune --filter $filter_str)"
  else
    log "Pruning $count stopped containers older than $DOCKER_CONTAINER_UNTIL ..."
    local prune_out
    prune_out=$(docker container prune -f --filter "$filter_str" 2>&1 || true)
    log "Docker container prune result: $(echo "$prune_out" | tail -n 2 | tr '\n' ' ')"
  fi
}

# Category D: Systemd Journal Archive Vacuum
cleanup_systemd_journal() {
  log "--- [CATEGORY D: SYSTEMD JOURNAL ARCHIVE] ---"
  local current_usage
  current_usage=$(journalctl --disk-usage 2>/dev/null || echo "Unknown")
  log "Current journal storage: $current_usage"

  if $DRY_RUN; then
    log_dry "Systemd Journal Archives" "Archived journals exceeding $JOURNAL_VACUUM_TIME or $JOURNAL_VACUUM_SIZE" "VACUUM (journalctl --vacuum-time=$JOURNAL_VACUUM_TIME --vacuum-size=$JOURNAL_VACUUM_SIZE)"
  else
    log "Vacuuming archived system journals (retention: $JOURNAL_VACUUM_TIME, max size: $JOURNAL_VACUUM_SIZE) ..."
    local vacuum_out
    vacuum_out=$(journalctl --vacuum-time="$JOURNAL_VACUUM_TIME" --vacuum-size="$JOURNAL_VACUUM_SIZE" 2>&1 || true)
    log "Journal vacuum result: $(echo "$vacuum_out" | tr '\n' ' ')"
  fi
}

# Category E: APT Package Cache
cleanup_apt_cache() {
  log "--- [CATEGORY E: APT PACKAGE CACHE] ---"
  if ! command -v apt-get >/dev/null 2>&1; then
    log "apt-get not present on host. Skipping APT package cache cleanup."
    return
  fi

  if $DRY_RUN; then
    log_dry "Obsolete .deb packages in /var/cache/apt" "Superseded packages no longer in repository" "AUTOCLEAN (apt-get --dry-run autoclean)"
  else
    log "Pruning obsolete APT package archives (autoclean) ..."
    local apt_out
    apt_out=$(apt-get autoclean -y 2>&1 || true)
    log "APT autoclean result: $(echo "$apt_out" | tail -n 2 | tr '\n' ' ')"
  fi
}

# Category F: Old Deployment & Rollback Logs
cleanup_old_logs() {
  log "--- [CATEGORY F: OLD DEPLOYMENT & ROLLBACK LOGS] ---"
  local target_dir="/var/log/kucet"

  if [[ ! -d "$target_dir" ]]; then
    log "Directory $target_dir does not exist. Skipping log pruning."
    return
  fi

  # Explicit allowlisted file patterns only: deploy_*.log* and rollback_*.log*
  # Continuous active logs (monitor.log, backup.log, health-check.log, nightly-cleanup.log) are NEVER deleted.
  local old_logs
  old_logs=$(find "$target_dir" -maxdepth 1 -type f \( -name "deploy_*.log*" -o -name "rollback_*.log*" \) -mtime "+$LOG_RETENTION_DAYS" 2>/dev/null || true)

  if [[ -z "$old_logs" ]]; then
    log "No deployment/rollback logs older than $LOG_RETENTION_DAYS days found."
    return
  fi

  local count=0
  local bytes_total=0

  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    # Safety Check: Must be regular file within /var/log/kucet
    if [[ ! -f "$f" || -L "$f" ]]; then
      log "SKIP (unsafe or symlink): $f"
      continue
    fi
    local f_size
    f_size=$(stat -c %s "$f" 2>/dev/null || echo 0)
    bytes_total=$((bytes_total + f_size))
    count=$((count + 1))

    if $DRY_RUN; then
      log_dry "$f" "Older than $LOG_RETENTION_DAYS days" "DELETE" "$(format_bytes "$f_size")"
    else
      rm -f "$f"
    fi
  done <<< "$old_logs"

  if $DRY_RUN; then
    log "Total log candidates: $count files ($(format_bytes "$bytes_total"))"
  else
    log "Pruned $count expired deployment/rollback logs (Reclaimed $(format_bytes "$bytes_total"))."
  fi
}

# Category G: Safe Allowlisted OS Temporary Files in /tmp
cleanup_os_tmp() {
  log "--- [CATEGORY G: ALLOWLISTED /tmp ARTIFACTS] ---"
  local target_dir="/tmp"

  if [[ ! -d "$target_dir" ]]; then
    return
  fi

  # Explicit allowlist of known disposable application/build files:
  # - kucet_health_check_*.log
  # - tsx-* (temporary TypeScript runtime directories)
  # - cf_quick.log (one-time benchmark log)
  local tmp_candidates
  tmp_candidates=$(find "$target_dir" -maxdepth 1 \( -name "kucet_health_check_*.log" -o -name "tsx-*" -o -name "cf_quick.log" \) -mtime "+$TMP_RETENTION_DAYS" 2>/dev/null || true)

  if [[ -z "$tmp_candidates" ]]; then
    log "No allowlisted /tmp artifacts older than $TMP_RETENTION_DAYS days found."
    return
  fi

  local count=0
  local bytes_total=0

  while IFS= read -r item; do
    [[ -z "$item" ]] && continue

    # Hard Safety Checks:
    # 1. Never touch symlinks
    if [[ -L "$item" ]]; then
      log "SKIP (symlink guard): $item"
      continue
    fi
    # 2. Never touch system sockets or pipes
    if [[ -S "$item" || -p "$item" ]]; then
      log "SKIP (socket/pipe guard): $item"
      continue
    fi
    # 3. Explicit protection of lock files
    if [[ "$item" == *"_deploy.lock"* || "$item" == *"_cleanup.lock"* || "$item" == *".backup.lock"* ]]; then
      log "SKIP (lock file guard): $item"
      continue
    fi

    local item_size
    item_size=$(du -sb "$item" 2>/dev/null | awk '{print $1}' || echo 0)
    bytes_total=$((bytes_total + item_size))
    count=$((count + 1))

    if $DRY_RUN; then
      log_dry "$item" "Allowlisted temporary artifact older than $TMP_RETENTION_DAYS days" "DELETE" "$(format_bytes "$item_size")"
    else
      rm -rf "$item"
    fi
  done <<< "$tmp_candidates"

  if $DRY_RUN; then
    log "Total /tmp candidates: $count items ($(format_bytes "$bytes_total"))"
  else
    log "Pruned $count allowlisted /tmp artifacts (Reclaimed $(format_bytes "$bytes_total"))."
  fi
}

# ---------------------------------------------------------------------------
# 4. Post-Flight Production Integrity Verification
# ---------------------------------------------------------------------------
postflight_verification() {
  log "============================================================"
  log "Executing post-cleanup production integrity verification ..."
  log "============================================================"

  local verification_failed=false

  # 1. Verify all core production containers are still running
  local required_containers=("kucet-cms-app" "kucet-cms-realtime" "kucet-cms-redis" "kucet-cms-db" "kucet-cms-proxy")
  for c in "${required_containers[@]}"; do
    if ! docker ps --format '{{.Names}}' | grep -q "^${c}$"; then
      log "CRITICAL ALERT: Production container '$c' is NOT running after cleanup!"
      verification_failed=true
    fi
  done

  # 2. Verify MySQL responsiveness
  if ! docker exec kucet-cms-db mysqladmin ping -h localhost >/dev/null 2>&1; then
    log "CRITICAL ALERT: MySQL unresponsive after cleanup!"
    verification_failed=true
  fi

  # 3. Verify Redis responsiveness
  if ! docker exec kucet-cms-redis redis-cli ping | grep -q "PONG" 2>/dev/null; then
    log "CRITICAL ALERT: Redis unresponsive after cleanup!"
    verification_failed=true
  fi

  # 4. Verify Next.js health endpoint
  local health_code
  health_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:3000/api/health" 2>/dev/null || echo "000")
  if [[ "$health_code" -ne 200 ]]; then
    log "CRITICAL ALERT: Application health endpoint returned HTTP $health_code after cleanup!"
    verification_failed=true
  fi

  # 5. Verify Persistent Storage
  if [[ ! -d "$STORAGE_DIR" || ! -d "$STORAGE_DIR/kucet" ]]; then
    log "CRITICAL ALERT: Persistent storage directory '$STORAGE_DIR' missing or altered!"
    verification_failed=true
  fi

  # 6. Verify Database Backups
  if [[ ! -d "$BACKUP_DIR" ]]; then
    log "CRITICAL ALERT: Database backup directory '$BACKUP_DIR' missing!"
    verification_failed=true
  else
    local backup_count
    backup_count=$(find "$BACKUP_DIR" -maxdepth 1 -name "*.sql.gz" 2>/dev/null | wc -l)
    if [[ "$backup_count" -lt 1 ]]; then
      log "WARNING: No .sql.gz backup archives found in $BACKUP_DIR!"
    fi
  fi

  # 7. Run full health-check.sh script if available
  if [[ -f "$HEALTH_CHECK_SCRIPT" ]]; then
    log "Running full production health-check suite ($HEALTH_CHECK_SCRIPT) ..."
    if ! bash "$HEALTH_CHECK_SCRIPT" >/dev/null 2>&1; then
      log "WARNING: health-check.sh reported one or more check failures. Inspect $LOG_DIR/health-check.log."
    else
      log "health-check.sh suite: ALL CHECKS PASSED."
    fi
  fi

  if $verification_failed; then
    log "CRITICAL: Post-cleanup verification FAILED. Please inspect system immediately."
    return 1
  fi

  log "Post-cleanup verification SUCCESSFUL: All services, databases, and persistent volumes verified intact."
  return 0
}

# ---------------------------------------------------------------------------
# Main Execution Controller
# ---------------------------------------------------------------------------
main() {
  local start_time
  start_time=$(date +%s)

  log "============================================================"
  log "  KUCET CMS — Production Automated Nightly Cleanup"
  log "  Host      : $(hostname) ($(uname -r))"
  log "  Date/Time : $(date '+%Y-%m-%d %H:%M:%S %Z')"
  log "  Dry-Run   : $DRY_RUN"
  log "============================================================"

  # Safety Guard: Root required for system cleanup operations
  if [[ "$EUID" -ne 0 ]]; then
    log "ERROR: This script must be run as root (use sudo)."
    exit 1
  fi

  # Acquire locks
  acquire_lock

  # Run pre-flight health check
  preflight_health_check

  # Record initial disk usage
  local pre_free_kb
  pre_free_kb=$(df / | awk 'NR==2 {print $4}')
  local pre_free_inodes
  pre_free_inodes=$(df -i / | awk 'NR==2 {print $4}')
  log "Pre-cleanup disk space free : $(format_bytes "$((pre_free_kb * 1024))")"
  log "Pre-cleanup inodes free     : $pre_free_inodes"

  # Execute targeted cleanups
  cleanup_docker_build_cache
  cleanup_docker_dangling_images
  cleanup_docker_stopped_containers
  cleanup_systemd_journal
  cleanup_apt_cache
  cleanup_old_logs
  cleanup_os_tmp

  # Post-flight verification (only relevant on live runs)
  if ! $DRY_RUN; then
    if ! postflight_verification; then
      log "ERROR: System failed post-cleanup verification checks."
      exit 1
    fi
  fi

  # Record final disk usage & calculate space reclaimed
  local post_free_kb
  post_free_kb=$(df / | awk 'NR==2 {print $4}')
  local post_free_inodes
  post_free_inodes=$(df -i / | awk 'NR==2 {print $4}')
  local reclaimed_kb=$((post_free_kb - pre_free_kb))
  if [[ "$reclaimed_kb" -lt 0 ]]; then
    reclaimed_kb=0
  fi

  local end_time
  end_time=$(date +%s)
  local duration=$((end_time - start_time))

  log "============================================================"
  log "  Cleanup Execution Summary"
  log "============================================================"
  log "  Execution Mode     : $( $DRY_RUN && echo 'DRY-RUN (Simulated)' || echo 'LIVE (Applied)' )"
  log "  Duration           : ${duration}s"
  log "  Post-cleanup free  : $(format_bytes "$((post_free_kb * 1024))")"
  log "  Inodes free        : $post_free_inodes"
  log "  Disk Reclaimed     : $(format_bytes "$((reclaimed_kb * 1024))")"
  log "  Status             : COMPLETED SUCCESSFULLY"
  log "============================================================"
}

main "$@"

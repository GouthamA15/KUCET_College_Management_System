#!/usr/bin/env bash
# =============================================================================
# setup-all.sh
# Master one-time setup orchestrator.
# Runs all KUCET CMS setup scripts in the correct order and verifies the
# autonomous deployment infrastructure is fully configured.
#
# Usage: sudo bash setup-all.sh
# Must be run as root (for systemd and logrotate operations).
# =============================================================================
set -euo pipefail

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
KUCET_CMS_DIR="/var/www/kucet-cms"
COMPOSE_FILE="$KUCET_CMS_DIR/DEPLOYMENT_PACKAGE/docker-compose.yml"
SCRIPTS_DIR="$KUCET_CMS_DIR/DEPLOYMENT_PACKAGE/SCRIPTS"
LOG_DIR="/var/log/kucet"
LOG_FILE="$LOG_DIR/setup-all.log"

# ---------------------------------------------------------------------------
# Logging helper
# ---------------------------------------------------------------------------
mkdir -p "$LOG_DIR"
touch "$LOG_FILE"
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

# ---------------------------------------------------------------------------
# Guard: must run as root
# ---------------------------------------------------------------------------
if [[ "$EUID" -ne 0 ]]; then
  log "ERROR: This script must be run as root (use sudo)."
  echo "Usage: sudo bash $0"
  exit 1
fi

SETUP_START=$(date +%s)
declare -A STEP_RESULTS

log "╔══════════════════════════════════════════════════════════════╗"
log "║   KUCET CMS — Autonomous Deployment Setup                   ║"
log "║   Starting full one-time infrastructure setup               ║"
log "╚══════════════════════════════════════════════════════════════╝"
log "  CMS dir   : $KUCET_CMS_DIR"
log "  Scripts   : $SCRIPTS_DIR"
log "  Log file  : $LOG_FILE"
log "  Server    : $(hostname) | $(uname -r)"
log "  Date/Time : $(date '+%Y-%m-%d %H:%M:%S %Z')"
log "──────────────────────────────────────────────────────────────"

# ---------------------------------------------------------------------------
# Helper: run a step with error capture
# ---------------------------------------------------------------------------
run_step() {
  local step_num="$1"
  local step_name="$2"
  local step_cmd="$3"

  log ""
  log "──────────────────────────────────────────────────────────────"
  log "  STEP $step_num: $step_name"
  log "──────────────────────────────────────────────────────────────"

  if eval "$step_cmd" 2>&1 | tee -a "$LOG_FILE"; then
    STEP_RESULTS["$step_name"]="✅ PASS"
    log "  ✅ STEP $step_num completed: $step_name"
  else
    STEP_RESULTS["$step_name"]="❌ FAIL"
    log "  ❌ STEP $step_num FAILED: $step_name"
    log "     Check the log above for details."
    # Continue with remaining steps even on failure
  fi
}

# ---------------------------------------------------------------------------
# STEP 1: Create /var/log/kucet/ directory
# ---------------------------------------------------------------------------
run_step "1" "Create log directory" \
  "mkdir -p /var/log/kucet && chmod 755 /var/log/kucet && log '  Created: /var/log/kucet/'"

# ---------------------------------------------------------------------------
# STEP 2: Install GitHub Actions runner as systemd service
# ---------------------------------------------------------------------------
run_step "2" "Setup GitHub Actions runner service" \
  "bash '$SCRIPTS_DIR/setup-runner-service.sh'"

# ---------------------------------------------------------------------------
# STEP 3: Install logrotate configuration
# ---------------------------------------------------------------------------
run_step "3" "Setup logrotate" \
  "bash '$SCRIPTS_DIR/setup-logrotate.sh'"

# ---------------------------------------------------------------------------
# STEP 4: Install cron jobs
# ---------------------------------------------------------------------------
run_step "4" "Setup cron jobs" \
  "bash '$SCRIPTS_DIR/setup-cron.sh'"

# ---------------------------------------------------------------------------
# STEP 5: Make ALL .sh files in SCRIPTS/ executable
# ---------------------------------------------------------------------------
log ""
log "──────────────────────────────────────────────────────────────"
log "  STEP 5: Make all shell scripts executable"
log "──────────────────────────────────────────────────────────────"
SCRIPTS_CHMOD=0
for script in "$SCRIPTS_DIR"/*.sh; do
  if [[ -f "$script" ]]; then
    chmod +x "$script"
    log "  chmod +x: $(basename "$script")"
    SCRIPTS_CHMOD=$((SCRIPTS_CHMOD + 1))
  fi
done
STEP_RESULTS["Make scripts executable"]="✅ PASS ($SCRIPTS_CHMOD scripts)"
log "  ✅ STEP 5 completed: $SCRIPTS_CHMOD scripts made executable"

# ---------------------------------------------------------------------------
# STEP 6: Run boot-recovery.sh to verify initial state
# ---------------------------------------------------------------------------
run_step "6" "Run boot recovery verification" \
  "bash '$SCRIPTS_DIR/boot-recovery.sh'"

# ---------------------------------------------------------------------------
# Final Summary
# ---------------------------------------------------------------------------
SETUP_END=$(date +%s)
SETUP_DURATION=$((SETUP_END - SETUP_START))

log ""
log "╔══════════════════════════════════════════════════════════════╗"
log "║   Setup Complete — Autonomous Deployment Summary            ║"
log "╠══════════════════════════════════════════════════════════════╣"

for step_name in "${!STEP_RESULTS[@]}"; do
  printf "[%s] [$(date '+%Y-%m-%d %H:%M:%S')] %-45s %s\n" \
    "$(date '+%Y-%m-%d %H:%M:%S')" "$step_name" "${STEP_RESULTS[$step_name]}" \
    | tee -a "$LOG_FILE"
done

log "╠══════════════════════════════════════════════════════════════╣"
log "  Total duration: ${SETUP_DURATION}s"
log "  Completed at  : $(date '+%Y-%m-%d %H:%M:%S %Z')"
log "╠══════════════════════════════════════════════════════════════╣"
log "  AUTONOMOUS DEPLOYMENT CONFIGURED:"
log "  ✅ GitHub Actions runner managed by systemd (auto-restarts)"
log "  ✅ Cron jobs installed (monitor every 5min, backups nightly)"
log "  ✅ Log rotation configured (daily, 30-day retention)"
log "  ✅ Boot recovery runs automatically on server restart"
log "  ✅ Self-healing monitor will restart failed containers"
log "  ✅ Auto-rollback triggers after 3 consecutive health failures"
log "╠══════════════════════════════════════════════════════════════╣"
log "  VERIFY WITH:"
log "    systemctl status actions.runner.*"
log "    crontab -l"
log "    systemctl status docker"
log "    cat /etc/logrotate.d/kucet-cms"
log "╚══════════════════════════════════════════════════════════════╝"

#!/usr/bin/env bash
# =============================================================================
# health-check.sh
# Comprehensive health check for the KUCET CMS production environment.
#
# Usage:
#   bash health-check.sh           # Human-readable PASS/FAIL table
#   bash health-check.sh --json    # JSON output for programmatic use
#
# Exit codes:
#   0  — All critical checks passed
#   1  — One or more critical checks failed
# =============================================================================
set -eu
set -o pipefail 2>/dev/null || true

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
KUCET_CMS_DIR="/var/www/kucet-cms"
COMPOSE_FILE="$KUCET_CMS_DIR/DEPLOYMENT_PACKAGE/docker-compose.yml"
LOG_FILE="${HEALTH_CHECK_LOG:-/tmp/kucet_health_check_${UID:-$(id -u)}.log}"
STORAGE_DIR="/var/www/kucet-storage"
HEALTH_ENDPOINT="http://localhost/api/health"
DISK_WARN_GB=10
RAM_WARN_PERCENT=90

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
JSON_MODE=false
for arg in "$@"; do
  [[ "$arg" == "--json" ]] && JSON_MODE=true
done

# ---------------------------------------------------------------------------
# Log helper (only writes to log file, not stdout in json mode)
# ---------------------------------------------------------------------------
mkdir -p /var/log/kucet
touch "$LOG_FILE" 2>/dev/null || true
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE" 2>/dev/null || true; }

# ---------------------------------------------------------------------------
# Result tracking
# ---------------------------------------------------------------------------
declare -A RESULTS        # RESULTS[check_name]="PASS|FAIL|WARN"
declare -A MESSAGES       # MESSAGES[check_name]="detail string"
CRITICAL_FAIL=false

record() {
  local name="$1" status="$2" msg="$3"
  RESULTS["$name"]="$status"
  MESSAGES["$name"]="$msg"
  log "[$status] $name — $msg"
}

# ---------------------------------------------------------------------------
# CHECK 1-5: Docker container running states
# ---------------------------------------------------------------------------
CRITICAL_CONTAINERS=("kucet-cms-app" "kucet-cms-realtime" "kucet-cms-proxy" "kucet-cms-db" "kucet-cms-redis")
OPTIONAL_CONTAINERS=("kucet-cms-monitor")

for container in "${CRITICAL_CONTAINERS[@]}"; do
  state=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "missing")
  health=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$container" 2>/dev/null || echo "missing")

  if [[ "$state" == "running" ]]; then
    if [[ "$health" == "unhealthy" ]]; then
      record "container:$container" "FAIL" "Running but UNHEALTHY (health=$health)"
      CRITICAL_FAIL=true
    elif [[ "$health" == "starting" ]]; then
      record "container:$container" "WARN" "Running, health check still starting"
    else
      record "container:$container" "PASS" "Running (health=$health)"
    fi
  else
    record "container:$container" "FAIL" "Container state: $state"
    CRITICAL_FAIL=true
  fi
done

for container in "${OPTIONAL_CONTAINERS[@]}"; do
  state=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "missing")
  health=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$container" 2>/dev/null || echo "missing")

  if [[ "$state" == "running" ]]; then
    record "container:$container" "PASS" "Running (health=$health)"
  else
    record "container:$container" "WARN" "Optional monitor container state: $state"
  fi
done

# ---------------------------------------------------------------------------
# CHECK 6: HTTP /api/health endpoint (with retry tolerance)
# ---------------------------------------------------------------------------
HTTP_STATUS="000"
for attempt in 1 2 3; do
  HTTP_STATUS=$(curl -so /dev/null -w "%{http_code}" --max-time 5 "$HEALTH_ENDPOINT" 2>/dev/null || echo "000")
  if [[ "$HTTP_STATUS" == "200" ]]; then
    break
  fi
  sleep 2
done

if [[ "$HTTP_STATUS" == "200" ]]; then
  record "http:/api/health" "PASS" "HTTP $HTTP_STATUS from $HEALTH_ENDPOINT"
else
  record "http:/api/health" "FAIL" "HTTP $HTTP_STATUS (expected 200) from $HEALTH_ENDPOINT"
  CRITICAL_FAIL=true
fi

# ---------------------------------------------------------------------------
# CHECK 6a: Realtime WebSocket /health endpoint
# ---------------------------------------------------------------------------
RT_STATUS=$(curl -so /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:4000/health" 2>/dev/null || echo "000")
if [[ "$RT_STATUS" == "200" ]]; then
  record "realtime:health" "PASS" "Socket.IO server responsive (HTTP $RT_STATUS)"
else
  record "realtime:health" "FAIL" "HTTP $RT_STATUS from http://127.0.0.1:4000/health"
  CRITICAL_FAIL=true
fi

# ---------------------------------------------------------------------------
# CHECK 6b: Database & Redis Connectivity Checks
# ---------------------------------------------------------------------------
if docker exec kucet-cms-db mysqladmin ping -h localhost >/dev/null 2>&1; then
  record "database:ping" "PASS" "MySQL database responsive"
else
  record "database:ping" "FAIL" "MySQL ping failed (mysqladmin ping -h localhost)"
  CRITICAL_FAIL=true
fi

if docker exec kucet-cms-redis redis-cli ping | grep -q "PONG" 2>/dev/null; then
  record "redis:ping" "PASS" "Redis responsive (PONG)"
else
  record "redis:ping" "FAIL" "Redis ping failed (redis-cli ping)"
  CRITICAL_FAIL=true
fi

# ---------------------------------------------------------------------------
# CHECK 6c: Endpoint crash check for critical admin routes (no 500 internal errors)
# ---------------------------------------------------------------------------
STAFF_REQ_STATUS=$(curl -so /dev/null -w "%{http_code}" --max-time 5 "http://localhost/api/admin/staff-requests" 2>/dev/null || echo "000")
if [[ "$STAFF_REQ_STATUS" == "401" || "$STAFF_REQ_STATUS" == "200" || "$STAFF_REQ_STATUS" == "303" || "$STAFF_REQ_STATUS" == "307" ]]; then
  record "api:staff-requests" "PASS" "Endpoint responsive (HTTP $STAFF_REQ_STATUS)"
else
  record "api:staff-requests" "FAIL" "HTTP $STAFF_REQ_STATUS (expected 200/303/401) from /api/admin/staff-requests"
  CRITICAL_FAIL=true
fi

HOD_REQ_STATUS=$(curl -so /dev/null -w "%{http_code}" --max-time 5 "http://localhost/api/admin/hod-requests" 2>/dev/null || echo "000")
if [[ "$HOD_REQ_STATUS" == "401" || "$HOD_REQ_STATUS" == "200" || "$HOD_REQ_STATUS" == "303" || "$HOD_REQ_STATUS" == "307" ]]; then
  record "api:hod-requests" "PASS" "Endpoint responsive (HTTP $HOD_REQ_STATUS)"
else
  record "api:hod-requests" "FAIL" "HTTP $HOD_REQ_STATUS (expected 200/303/401) from /api/admin/hod-requests"
  CRITICAL_FAIL=true
fi

# ---------------------------------------------------------------------------
# CHECK 6d: PWA Service Worker & Offline assets responsiveness
# ---------------------------------------------------------------------------
SW_STATUS=$(curl -so /dev/null -w "%{http_code}" --max-time 5 "http://localhost/sw.js" 2>/dev/null || echo "000")
if [[ "$SW_STATUS" == "200" || "$SW_STATUS" == "304" ]]; then
  record "pwa:service-worker" "PASS" "sw.js responsive (HTTP $SW_STATUS)"
else
  record "pwa:service-worker" "FAIL" "HTTP $SW_STATUS (expected 200) from /sw.js"
  CRITICAL_FAIL=true
fi

OFFLINE_STATUS=$(curl -so /dev/null -w "%{http_code}" --max-time 5 "http://localhost/offline" 2>/dev/null || echo "000")
if [[ "$OFFLINE_STATUS" == "200" || "$OFFLINE_STATUS" == "304" ]]; then
  record "pwa:offline-fallback" "PASS" "Offline page responsive (HTTP $OFFLINE_STATUS)"
else
  record "pwa:offline-fallback" "FAIL" "HTTP $OFFLINE_STATUS (expected 200) from /offline"
  CRITICAL_FAIL=true
fi

# ---------------------------------------------------------------------------
# CHECK 7: Host Server Power Management (Sleep/Suspend Masked)
# ---------------------------------------------------------------------------
ALL_SLEEP_MASKED=true
if command -v systemctl >/dev/null 2>&1; then
  for target in sleep.target suspend.target hibernate.target hybrid-sleep.target; do
    t_status=$(systemctl is-enabled "$target" 2>/dev/null || echo "unknown")
    if [[ "$t_status" != "masked" ]]; then
      ALL_SLEEP_MASKED=false
    fi
  done
fi

if $ALL_SLEEP_MASKED; then
  record "server:power-sleep" "PASS" "Host sleep/suspend targets masked"
else
  record "server:power-sleep" "WARN" "Some sleep targets not masked"
fi

# ---------------------------------------------------------------------------
# CHECK 8: Tailscale Daemon & Public Funnel Status
# ---------------------------------------------------------------------------
if command -v tailscale >/dev/null 2>&1; then
  if systemctl is-active tailscaled >/dev/null 2>&1; then
    record "tailscale:daemon" "PASS" "tailscaled active"
  else
    record "tailscale:daemon" "FAIL" "tailscaled service inactive"
    CRITICAL_FAIL=true
  fi

  if tailscale serve status 2>/dev/null | grep -q "127.0.0.1:80"; then
    record "tailscale:funnel" "PASS" "Tailscale Funnel proxying to port 80"
  else
    record "tailscale:funnel" "WARN" "Tailscale Funnel not proxying to port 80"
  fi
else
  record "tailscale:daemon" "WARN" "tailscale CLI not found"
fi

# ---------------------------------------------------------------------------
# CHECK 9: Nginx config validity
# ---------------------------------------------------------------------------
nginx_out=$(docker exec kucet-cms-proxy nginx -t 2>&1 || echo "FAILED")
if echo "$nginx_out" | grep -q "syntax is ok" && echo "$nginx_out" | grep -q "test is successful"; then
  record "nginx:config" "PASS" "nginx -t: syntax ok, test successful"
else
  record "nginx:config" "FAIL" "nginx -t failed: $nginx_out"
  CRITICAL_FAIL=true
fi

# ---------------------------------------------------------------------------
# CHECK 10a: Public HTTPS API Ingress Reachability
# ---------------------------------------------------------------------------
PUBLIC_ENDPOINT="https://kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc.tailf6b4a7.ts.net/api/health"
PUB_HTTPS_STATUS=$(curl -so /dev/null -w "%{http_code}" --max-time 8 "$PUBLIC_ENDPOINT" 2>/dev/null || echo "000")
if [[ "$PUB_HTTPS_STATUS" == "200" ]]; then
  record "ingress:public-https" "PASS" "Public HTTPS API responsive (HTTP $PUB_HTTPS_STATUS)"
else
  record "ingress:public-https" "WARN" "Public HTTPS API returned HTTP $PUB_HTTPS_STATUS"
fi

# ---------------------------------------------------------------------------
# CHECK 10b: Public HTML Homepage Ingress Reachability
# ---------------------------------------------------------------------------
PUBLIC_ROOT="https://kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc.tailf6b4a7.ts.net/"
PUB_ROOT_STATUS=$(curl -so /dev/null -w "%{http_code}" --max-time 8 "$PUBLIC_ROOT" 2>/dev/null || echo "000")
if [[ "$PUB_ROOT_STATUS" == "200" ]]; then
  record "ingress:public-html" "PASS" "Public Homepage responsive (HTTP $PUB_ROOT_STATUS)"
else
  record "ingress:public-html" "WARN" "Public Homepage returned HTTP $PUB_ROOT_STATUS"
fi

# ---------------------------------------------------------------------------
# CHECK 11a: Host storage directory exists
# ---------------------------------------------------------------------------
HOST_STORAGE_DIR="/var/www/kucet-storage"
if [[ -d "$HOST_STORAGE_DIR" ]]; then
  record "storage:host-mount" "PASS" "$HOST_STORAGE_DIR exists on host"
else
  # Try to create if missing (e.g. initial setup)
  mkdir -p "$HOST_STORAGE_DIR/kucet" 2>/dev/null || true
  if [[ -d "$HOST_STORAGE_DIR" ]]; then
    record "storage:host-mount" "PASS" "$HOST_STORAGE_DIR created on host"
  else
    record "storage:host-mount" "FAIL" "$HOST_STORAGE_DIR does not exist on host"
    CRITICAL_FAIL=true
  fi
fi

# ---------------------------------------------------------------------------
# CHECK 11b: Container storage volume is writable by Next.js user
# ---------------------------------------------------------------------------
STORAGE_TEST_CMD="mkdir -p /app/storage/kucet/.health_test && echo 'health_check_ok' > /app/storage/kucet/.health_test/test.tmp && grep -q 'health_check_ok' /app/storage/kucet/.health_test/test.tmp && rm -rf /app/storage/kucet/.health_test"
if docker exec kucet-cms-app sh -c "$STORAGE_TEST_CMD" 2>/dev/null; then
  record "storage:container-writable" "PASS" "Container /app/storage is writable by nextjs user"
else
  record "storage:container-writable" "FAIL" "Container /app/storage write/delete test failed"
  CRITICAL_FAIL=true
fi

# ---------------------------------------------------------------------------
# CHECK 12: Disk space (warn if < DISK_WARN_GB free)
# ---------------------------------------------------------------------------
DISK_FREE_KB=$(df / | awk 'NR==2 {print $4}')
DISK_FREE_GB=$((DISK_FREE_KB / 1024 / 1024))
if [[ "$DISK_FREE_GB" -ge "$DISK_WARN_GB" ]]; then
  record "disk:space" "PASS" "${DISK_FREE_GB}GB free on / (threshold: ${DISK_WARN_GB}GB)"
else
  record "disk:space" "WARN" "LOW DISK: only ${DISK_FREE_GB}GB free on / (threshold: ${DISK_WARN_GB}GB)"
fi

# ---------------------------------------------------------------------------
# CHECK 13: RAM usage (warn if > RAM_WARN_PERCENT used)
# ---------------------------------------------------------------------------
RAM_TOTAL=$(free | awk '/^Mem:/ {print $2}')
RAM_USED=$(free  | awk '/^Mem:/ {print $3}')
RAM_PERCENT=$(( RAM_USED * 100 / RAM_TOTAL ))
if [[ "$RAM_PERCENT" -le "$RAM_WARN_PERCENT" ]]; then
  record "ram:usage" "PASS" "${RAM_PERCENT}% RAM used (threshold: ${RAM_WARN_PERCENT}%)"
else
  record "ram:usage" "WARN" "HIGH RAM: ${RAM_PERCENT}% used (threshold: ${RAM_WARN_PERCENT}%)"
fi

# ---------------------------------------------------------------------------
# Output: JSON mode
# ---------------------------------------------------------------------------
if $JSON_MODE; then
  echo "{"
  echo "  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
  echo "  \"overall\": \"$( $CRITICAL_FAIL && echo FAIL || echo PASS )\","
  echo "  \"checks\": {"
  first=true
  for key in "${!RESULTS[@]}"; do
    $first || echo ","
    printf '    "%s": {"status": "%s", "message": "%s"}' \
      "$key" "${RESULTS[$key]}" "${MESSAGES[$key]//\"/\'}"
    first=false
  done
  echo ""
  echo "  }"
  echo "}"
  $CRITICAL_FAIL && exit 1 || exit 0
fi

# ---------------------------------------------------------------------------
# Output: Human-readable PASS/FAIL summary table
# ---------------------------------------------------------------------------
echo ""
echo "╔══════════════════════════════════════════════════════════════════════════╗"
echo "║              KUCET CMS — Production Health Check Report                 ║"
echo "║              $(date '+%Y-%m-%d %H:%M:%S %Z')                                   ║"
echo "╠══════════════════════════════╦═══════════╦══════════════════════════════╣"
printf "║ %-28s ║ %-9s ║ %-28s ║\n" "CHECK" "STATUS" "DETAIL"
echo "╠══════════════════════════════╬═══════════╬══════════════════════════════╣"

for key in "${!RESULTS[@]}"; do
  status="${RESULTS[$key]}"
  msg="${MESSAGES[$key]}"
  # Truncate message for table display
  short_msg="${msg:0:28}"
  case "$status" in
    PASS) icon="✅ PASS" ;;
    FAIL) icon="❌ FAIL" ;;
    WARN) icon="⚠️  WARN" ;;
    *)    icon="   $status" ;;
  esac
  printf "║ %-28s ║ %-9s ║ %-28s ║\n" "${key:0:28}" "$icon" "$short_msg"
done

echo "╚══════════════════════════════╩═══════════╩══════════════════════════════╝"

# ---------------------------------------------------------------------------
# Layer-by-Layer Architectural Diagnostic Breakdown
# ---------------------------------------------------------------------------
echo ""
echo "============================================================"
echo "         ARCHITECTURAL LAYER DIAGNOSTIC BREAKDOWN"
echo "============================================================"

# Layer 1: Host System & Power
echo "--- [LAYER 1: HOST SYSTEM & POWER] ---"
printf "  %-32s : %s\n" "Disk Storage" "${RESULTS[disk:space]:-UNKNOWN}"
printf "  %-32s : %s\n" "RAM Utilization" "${RESULTS[ram:usage]:-UNKNOWN}"
printf "  %-32s : %s\n" "Power Sleep Masking" "${RESULTS[server:power-sleep]:-UNKNOWN}"

# Layer 2: Docker Containers & Core Services
echo "--- [LAYER 2: CONTAINER & CORE SERVICES] ---"
printf "  %-32s : %s\n" "Next.js App Container" "${RESULTS[container:kucet-cms-app]:-UNKNOWN}"
printf "  %-32s : %s\n" "Socket.IO Realtime Container" "${RESULTS[container:kucet-cms-realtime]:-UNKNOWN}"
printf "  %-32s : %s\n" "Redis Cache Container" "${RESULTS[container:kucet-cms-redis]:-UNKNOWN}"
printf "  %-32s : %s\n" "MySQL Database Container" "${RESULTS[container:kucet-cms-db]:-UNKNOWN}"
printf "  %-32s : %s\n" "Nginx Reverse Proxy Container" "${RESULTS[container:kucet-cms-proxy]:-UNKNOWN}"
printf "  %-32s : %s\n" "Health Monitor Container" "${RESULTS[container:kucet-cms-monitor]:-UNKNOWN}"

# Layer 3: Storage & Local Reverse Proxy
echo "--- [LAYER 3: STORAGE & REVERSE PROXY] ---"
printf "  %-32s : %s\n" "Host Storage Mount" "${RESULTS[storage:host-mount]:-UNKNOWN}"
printf "  %-32s : %s\n" "Container Storage Writable" "${RESULTS[storage:container-writable]:-UNKNOWN}"
printf "  %-32s : %s\n" "Nginx Configuration" "${RESULTS[nginx:config]:-UNKNOWN}"

# Layer 4: Tailscale & Public Internet Ingress
echo "--- [LAYER 4: TAILSCALE & PUBLIC INGRESS] ---"
printf "  %-32s : %s\n" "Tailscale Daemon Active" "${RESULTS[tailscale:daemon]:-UNKNOWN}"
printf "  %-32s : %s\n" "Tailscale Funnel Proxy Mapping" "${RESULTS[tailscale:funnel]:-UNKNOWN}"
printf "  %-32s : %s\n" "Public HTTPS API Ingress" "${RESULTS[ingress:public-https]:-UNKNOWN}"
printf "  %-32s : %s\n" "Public HTML Homepage Ingress" "${RESULTS[ingress:public-html]:-UNKNOWN}"

# Layer 5: Application & API Integrity
echo "--- [LAYER 5: APPLICATION & API INTEGRITY] ---"
printf "  %-32s : %s\n" "Internal Health API" "${RESULTS[http:/api/health]:-UNKNOWN}"
printf "  %-32s : %s\n" "Realtime WebSocket API" "${RESULTS[realtime:health]:-UNKNOWN}"
printf "  %-32s : %s\n" "Staff Requests API Guard" "${RESULTS[api:staff-requests]:-UNKNOWN}"
printf "  %-32s : %s\n" "HOD Requests API Guard" "${RESULTS[api:hod-requests]:-UNKNOWN}"
printf "  %-32s : %s\n" "PWA Service Worker Asset" "${RESULTS[pwa:service-worker]:-UNKNOWN}"
printf "  %-32s : %s\n" "PWA Offline Fallback Page" "${RESULTS[pwa:offline-fallback]:-UNKNOWN}"
echo "============================================================"

if $CRITICAL_FAIL; then
  echo ""
  echo "❌  OVERALL: CRITICAL CHECKS FAILED — Deployment should be rolled back."
  echo ""
  log "OVERALL: FAIL — one or more critical checks failed."
  exit 1
else
  echo ""
  echo "✅  OVERALL: ALL CRITICAL CHECKS PASSED."
  echo ""
  log "OVERALL: PASS — all critical checks passed."
  exit 0
fi

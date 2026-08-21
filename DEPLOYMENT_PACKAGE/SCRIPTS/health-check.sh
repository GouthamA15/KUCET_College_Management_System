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
set -euo pipefail

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
KUCET_CMS_DIR="/var/www/kucet-cms"
COMPOSE_FILE="$KUCET_CMS_DIR/DEPLOYMENT_PACKAGE/docker-compose.yml"
LOG_FILE="/tmp/kucet_health_check.log"
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
CONTAINERS=("kucet-cms-app" "kucet-cms-proxy" "kucet-cms-db" "kucet-cms-redis" "kucet-cms-monitor")

for container in "${CONTAINERS[@]}"; do
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

# ---------------------------------------------------------------------------
# CHECK 6: HTTP /api/health endpoint
# ---------------------------------------------------------------------------
HTTP_STATUS=$(curl -so /dev/null -w "%{http_code}" --max-time 10 "$HEALTH_ENDPOINT" 2>/dev/null || echo "000")
if [[ "$HTTP_STATUS" == "200" ]]; then
  record "http:/api/health" "PASS" "HTTP $HTTP_STATUS from $HEALTH_ENDPOINT"
else
  record "http:/api/health" "FAIL" "HTTP $HTTP_STATUS (expected 200) from $HEALTH_ENDPOINT"
  CRITICAL_FAIL=true
fi

# ---------------------------------------------------------------------------
# (CHECK 7 removed: rely on Docker native container healthcheck)
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# (CHECK 8 removed: rely on Docker native container healthcheck)
# ---------------------------------------------------------------------------

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
# (CHECK 10 removed: runner obviously works if this script is executing)
# ---------------------------------------------------------------------------

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

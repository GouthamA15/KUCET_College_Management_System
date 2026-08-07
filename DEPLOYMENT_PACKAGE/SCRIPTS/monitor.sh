#!/usr/bin/env bash
# =============================================================================
# monitor.sh
# Lightweight self-healing monitoring script.
# Designed to run every 5 minutes via cron.
#
# Features:
#   - Restarts stopped Docker containers automatically
#   - Restarts GitHub Actions runner if it stops
#   - Triggers rollback after 3 consecutive /api/health failures
#   - Sends webhook alerts on any auto-recovery action
#   - Idempotent — safe to run every 5 minutes
# =============================================================================
set -euo pipefail

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
KUCET_CMS_DIR="/var/www/kucet-cms"
COMPOSE_FILE="$KUCET_CMS_DIR/DEPLOYMENT_PACKAGE/docker-compose.yml"
SCRIPTS_DIR="$KUCET_CMS_DIR/DEPLOYMENT_PACKAGE/SCRIPTS"
LOG_FILE="/var/log/kucet/monitor.log"
HEALTH_ENDPOINT="http://localhost/api/health"
HEALTH_FAILURES_FILE="/tmp/kucet_health_failures"
HEALTH_FAILURE_THRESHOLD=3
LOG_ROTATE_THRESHOLD_MB=50

# Map: container_name → compose service name
declare -A CONTAINER_SERVICE_MAP=(
  ["kucet-cms-app"]="app"
  ["kucet-cms-proxy"]="proxy"
  ["kucet-cms-db"]="db"
  ["kucet-cms-redis"]="redis"
  ["kucet-cms-monitor"]="monitor"
)

# ---------------------------------------------------------------------------
# Source production environment (non-fatal)
# ---------------------------------------------------------------------------
ENV_FILE="$KUCET_CMS_DIR/.env.production"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

# ---------------------------------------------------------------------------
# Ensure log directory and file exist
# ---------------------------------------------------------------------------
mkdir -p /var/log/kucet
touch "$LOG_FILE"

# ---------------------------------------------------------------------------
# Logging helper
# ---------------------------------------------------------------------------
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

# ---------------------------------------------------------------------------
# Rotate log if > LOG_ROTATE_THRESHOLD_MB
# ---------------------------------------------------------------------------
rotate_log_if_needed() {
  if [[ -f "$LOG_FILE" ]]; then
    local size_mb
    size_mb=$(( $(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0) / 1024 / 1024 ))
    if [[ $size_mb -ge $LOG_ROTATE_THRESHOLD_MB ]]; then
      log "Log file exceeds ${LOG_ROTATE_THRESHOLD_MB}MB — triggering logrotate ..."
      logrotate -f /etc/logrotate.d/kucet-cms 2>/dev/null || \
        mv "$LOG_FILE" "${LOG_FILE}.$(date +%Y%m%d_%H%M%S)" && touch "$LOG_FILE"
      log "Log rotated."
    fi
  fi
}

# ---------------------------------------------------------------------------
# Webhook notification helper
# ---------------------------------------------------------------------------
send_webhook() {
  local message="$1"
  if [[ -n "${BACKUP_ALERT_WEBHOOK_URL:-}" ]]; then
    local payload
    payload=$(printf '{"text": "%s"}' "$message")
    curl -s -X POST \
      -H "Content-Type: application/json" \
      -d "$payload" \
      "$BACKUP_ALERT_WEBHOOK_URL" > /dev/null 2>&1 || \
      log "WARNING: Failed to send webhook notification."
  fi
}

# ---------------------------------------------------------------------------
# Main monitoring logic
# ---------------------------------------------------------------------------
log "--- monitor.sh run started ---"
rotate_log_if_needed

ALERTS_TRIGGERED=false

# ---
# CHECK 1: Docker containers
# ---
log "Checking Docker containers ..."
for container in "${!CONTAINER_SERVICE_MAP[@]}"; do
  service="${CONTAINER_SERVICE_MAP[$container]}"
  state=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "missing")

  if [[ "$state" == "running" ]]; then
    log "  [OK] $container is running."
  else
    log "  [ALERT] $container is $state — restarting via docker compose ..."
    docker compose \
      -p deployment_package \
      -f "$COMPOSE_FILE" \
      up -d "$service" 2>&1 | tee -a "$LOG_FILE" || \
      log "  [ERROR] Failed to restart $container/$service!"

    local_msg="🔁 KUCET CMS Monitor: Auto-restarted container '$container' (was: $state) at $(date '+%Y-%m-%d %H:%M:%S')"
    log "  $local_msg"
    send_webhook "$local_msg"
    ALERTS_TRIGGERED=true
  fi
done

# ---
# CHECK 2: GitHub Actions runner service
# ---
log "Checking GitHub Actions runner service ..."
RUNNER_UNIT=$(systemctl list-units --type=service --all 2>/dev/null \
  | grep -oP 'actions\.runner\.[^\s]+\.service' | head -1 || true)

if [[ -n "$RUNNER_UNIT" ]]; then
  RUNNER_STATE=$(systemctl is-active "$RUNNER_UNIT" 2>/dev/null || echo "inactive")
  if [[ "$RUNNER_STATE" == "active" ]]; then
    log "  [OK] $RUNNER_UNIT is active."
  else
    log "  [ALERT] $RUNNER_UNIT is $RUNNER_STATE — restarting ..."
    systemctl restart "$RUNNER_UNIT" 2>&1 | tee -a "$LOG_FILE" || \
      log "  [ERROR] Failed to restart $RUNNER_UNIT!"

    local_msg="🔁 KUCET CMS Monitor: Auto-restarted GitHub runner '$RUNNER_UNIT' (was: $RUNNER_STATE) at $(date '+%Y-%m-%d %H:%M:%S')"
    log "  $local_msg"
    send_webhook "$local_msg"
    ALERTS_TRIGGERED=true
  fi
else
  log "  [WARN] No actions.runner.* service unit found."
fi

# ---
# CHECK 3: /api/health endpoint with consecutive failure tracking
# ---
log "Checking /api/health endpoint ..."
HTTP_STATUS=$(curl -so /dev/null -w "%{http_code}" --max-time 10 "$HEALTH_ENDPOINT" 2>/dev/null || echo "000")

if [[ "$HTTP_STATUS" == "200" ]]; then
  log "  [OK] /api/health returned HTTP $HTTP_STATUS."
  # Reset failure counter on success
  rm -f "$HEALTH_FAILURES_FILE"
else
  # Increment failure counter
  CURRENT_FAILURES=0
  if [[ -f "$HEALTH_FAILURES_FILE" ]]; then
    CURRENT_FAILURES=$(cat "$HEALTH_FAILURES_FILE" 2>/dev/null || echo "0")
  fi
  NEW_FAILURES=$((CURRENT_FAILURES + 1))
  echo "$NEW_FAILURES" > "$HEALTH_FAILURES_FILE"

  log "  [WARN] /api/health returned HTTP $HTTP_STATUS. Consecutive failures: $NEW_FAILURES/$HEALTH_FAILURE_THRESHOLD"

  if [[ $NEW_FAILURES -ge $HEALTH_FAILURE_THRESHOLD ]]; then
    log "  [CRITICAL] Health check failed $NEW_FAILURES consecutive times — triggering rollback!"

    # Get last known good commit from deployment log
    LAST_GOOD_COMMIT=$(python3 - <<'PYEOF' 2>/dev/null || echo "")
import json, sys
try:
    with open("/var/log/kucet/deployments.json") as f:
        records = json.load(f)
    # Find last successful deployment
    good = [r for r in reversed(records) if r.get("status") == "success"]
    print(good[0]["new_commit"] if good else "")
except:
    print("")
PYEOF

    if [[ -n "$LAST_GOOD_COMMIT" ]]; then
      log "  Rolling back to last known good commit: $LAST_GOOD_COMMIT"
      send_webhook "🚨 KUCET CMS Monitor: Health endpoint failed $NEW_FAILURES times. Triggering auto-rollback to ${LAST_GOOD_COMMIT:0:8}."
      bash "$SCRIPTS_DIR/rollback.sh" "$LAST_GOOD_COMMIT" 2>&1 | tee -a "$LOG_FILE" || \
        log "  [CRITICAL] Rollback failed! Manual intervention required."
      # Reset failure counter after rollback attempt
      rm -f "$HEALTH_FAILURES_FILE"
    else
      log "  [CRITICAL] Cannot rollback — no successful deployment record found."
      send_webhook "🚨 KUCET CMS Monitor: Health check failed $NEW_FAILURES times but no rollback target found. MANUAL INTERVENTION REQUIRED."
    fi
    ALERTS_TRIGGERED=true
  fi
fi

# ---
# Summary
# ---
if $ALERTS_TRIGGERED; then
  log "--- monitor.sh run completed — ALERTS TRIGGERED ---"
else
  log "--- monitor.sh run completed — all systems nominal ---"
fi

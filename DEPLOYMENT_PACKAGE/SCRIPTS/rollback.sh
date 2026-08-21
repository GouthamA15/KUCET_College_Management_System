#!/usr/bin/env bash
# =============================================================================
# rollback.sh
# Rolls back the KUCET CMS app container to a specific git commit.
# Called automatically by deploy.sh on health check failure, or manually.
#
# Usage:
#   bash rollback.sh <TARGET_COMMIT>
#
# Exit codes:
#   0  — Rollback succeeded and health check passed
#   1  — Invalid arguments or rollback failed (health check still failing)
#   2  — Rollback completed but health check still failing (CRITICAL)
# =============================================================================
set -euo pipefail

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
KUCET_CMS_DIR="/var/www/kucet-cms"
COMPOSE_FILE="$KUCET_CMS_DIR/DEPLOYMENT_PACKAGE/docker-compose.yml"
SCRIPTS_DIR="$KUCET_CMS_DIR/DEPLOYMENT_PACKAGE/SCRIPTS"
HEALTH_CHECK="$SCRIPTS_DIR/health-check.sh"
PREPARE_STORAGE="$SCRIPTS_DIR/prepare-storage.sh"
LOG_DIR="/var/log/kucet"
LOG_FILE="$LOG_DIR/rollback_$(date +%Y%m%d_%H%M%S).log"

# ---------------------------------------------------------------------------
# Argument validation
# ---------------------------------------------------------------------------
if [[ $# -lt 1 ]] || [[ -z "$1" ]]; then
  echo "ERROR: TARGET_COMMIT is required."
  echo "Usage: bash rollback.sh <TARGET_COMMIT>"
  exit 1
fi

TARGET_COMMIT="$1"

# ---------------------------------------------------------------------------
# Setup log dir and tee output
# ---------------------------------------------------------------------------
mkdir -p "$LOG_DIR"
exec > >(tee -a "$LOG_FILE") 2>&1

# ---------------------------------------------------------------------------
# Logging helper
# ---------------------------------------------------------------------------
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

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
# Begin rollback
# ---------------------------------------------------------------------------
ROLLBACK_START=$(date +%s)

log "============================================================"
log "  KUCET CMS — Rollback Initiated"
log "============================================================"
log "  Target commit : $TARGET_COMMIT"
log "  Start time    : $(date '+%Y-%m-%d %H:%M:%S %Z')"
log "  Log file      : $LOG_FILE"
log "============================================================"

send_webhook "⚠️ KUCET CMS: Rollback initiated to commit ${TARGET_COMMIT:0:8} at $(date '+%Y-%m-%d %H:%M:%S')"

# ---------------------------------------------------------------------------
# Load environment (non-fatal if missing)
# ---------------------------------------------------------------------------
ENV_FILE="$KUCET_CMS_DIR/.env.production"
if [[ -f "$ENV_FILE" ]]; then
  log "Loading environment from $ENV_FILE ..."
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
else
  log "WARNING: $ENV_FILE not found — proceeding without it."
fi

# ---------------------------------------------------------------------------
# Checkout target commit
# ---------------------------------------------------------------------------
cd "$KUCET_CMS_DIR"

CURRENT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
log "Current commit: $CURRENT_COMMIT"
log "Rolling back to: $TARGET_COMMIT ..."

git checkout "$TARGET_COMMIT" 2>&1 || {
  log "ERROR: git checkout $TARGET_COMMIT failed!"
  send_webhook "❌ KUCET CMS: Rollback FAILED — git checkout ${TARGET_COMMIT:0:8} failed."
  exit 1
}

log "Git checkout to $TARGET_COMMIT completed."

# ---------------------------------------------------------------------------
# Prepare host storage directories with least privilege (no chmod 777)
# ---------------------------------------------------------------------------
log "Preparing persistent host storage directories (/var/www/kucet-storage) ..."
if [[ -f "$PREPARE_STORAGE" ]]; then
  bash "$PREPARE_STORAGE" 2>&1 || true
else
  mkdir -p /var/www/kucet-storage/kucet/students/pfp \
           /var/www/kucet-storage/kucet/students/signatures \
           /var/www/kucet-storage/kucet/requests/pfp \
           /var/www/kucet-storage/kucet/requests/signatures \
           /var/www/kucet-storage/kucet/requests/proofs \
           /var/www/kucet-storage/kucet/certificates/payments \
           /var/www/kucet-storage/kucet/admission_drafts/pfp \
           /var/www/kucet-storage/kucet/admission_drafts/signatures \
           /var/www/kucet-storage/kucet/staff/pfp \
           /var/www/kucet-storage/kucet/staff/signatures \
           /var/www/kucet-storage/kucet/bug_reports \
           /var/www/kucet-storage/kucet/backups \
           /var/www/kucet-storage/kucet/.health_test \
           /var/www/kucet-storage/kucet/institution \
           /var/kucet-db-backup 2>/dev/null || true
  chmod 755 /var/www/kucet-storage /var/www/kucet-storage/kucet /var/www/kucet-storage/kucet/institution 2>/dev/null || true
  chmod 700 /var/kucet-db-backup 2>/dev/null || true
  chown 1001:1001 /var/www/kucet-storage /var/www/kucet-storage/kucet 2>/dev/null || sudo chown 1001:1001 /var/www/kucet-storage /var/www/kucet-storage/kucet 2>/dev/null || true
fi

# ---------------------------------------------------------------------------
# Rebuild and restart ONLY the app container
# ---------------------------------------------------------------------------
log "Removing old app container ..."
docker rm -f kucet-cms-app 2>&1 || true

log "Building and starting app container at rollback commit ..."
docker compose \
  -p deployment_package \
  -f "$COMPOSE_FILE" \
  up -d --build --no-deps app 2>&1

# ---------------------------------------------------------------------------
# Wait for container health (up to 60 seconds, check every 5s)
# ---------------------------------------------------------------------------
log "Waiting for app container to become healthy (max 60s) ..."
WAIT_MAX=60
WAIT_INTERVAL=5
WAITED=0
APP_HEALTHY=false

while [[ $WAITED -lt $WAIT_MAX ]]; do
  CONTAINER_STATE=$(docker inspect --format='{{.State.Status}}' kucet-cms-app 2>/dev/null || echo "missing")
  HEALTH_STATE=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' kucet-cms-app 2>/dev/null || echo "unknown")

  log "  [${WAITED}s] container=$CONTAINER_STATE health=$HEALTH_STATE"

  if [[ "$CONTAINER_STATE" == "running" ]]; then
    if [[ "$HEALTH_STATE" == "healthy" || "$HEALTH_STATE" == "no-healthcheck" ]]; then
      APP_HEALTHY=true
      break
    fi
  elif [[ "$CONTAINER_STATE" == "exited" || "$CONTAINER_STATE" == "dead" ]]; then
    log "ERROR: App container exited during rollback!"
    docker logs kucet-cms-app --tail 50 2>&1 || true
    break
  fi

  sleep $WAIT_INTERVAL
  WAITED=$((WAITED + WAIT_INTERVAL))
done

if ! $APP_HEALTHY; then
  log "WARNING: App container did not become healthy within ${WAIT_MAX}s during rollback."
fi

# ---------------------------------------------------------------------------
# Reconnect to network with alias (if needed)
# ---------------------------------------------------------------------------
log "Checking app container network connectivity ..."
IS_CONNECTED=$(docker inspect -f '{{json .NetworkSettings.Networks}}' kucet-cms-app 2>/dev/null | grep -o 'deployment_package_cms-network' || true)
if [[ -z "$IS_CONNECTED" ]]; then
  log "Connecting app container to cms-network with alias 'app' ..."
  docker network connect deployment_package_cms-network kucet-cms-app --alias app 2>&1 || true
else
  log "App container is already connected to cms-network."
fi

# ---------------------------------------------------------------------------
# Run health check after rollback
# ---------------------------------------------------------------------------
log "Running health check after rollback ..."
sleep 5

if bash "$HEALTH_CHECK" 2>&1; then
  ROLLBACK_END=$(date +%s)
  ROLLBACK_DURATION=$((ROLLBACK_END - ROLLBACK_START))

  log "============================================================"
  log "  Rollback SUCCEEDED ✅"
  log "  Reverted to : $TARGET_COMMIT"
  log "  Duration    : ${ROLLBACK_DURATION}s"
  log "  End time    : $(date '+%Y-%m-%d %H:%M:%S %Z')"
  log "============================================================"

  send_webhook "✅ KUCET CMS: Rollback to ${TARGET_COMMIT:0:8} SUCCEEDED after ${ROLLBACK_DURATION}s. Service restored."
  exit 0
else
  ROLLBACK_END=$(date +%s)
  ROLLBACK_DURATION=$((ROLLBACK_END - ROLLBACK_START))

  log "============================================================"
  log "  CRITICAL: Rollback health check STILL FAILING ❌"
  log "  Reverted to : $TARGET_COMMIT"
  log "  Duration    : ${ROLLBACK_DURATION}s"
  log "  End time    : $(date '+%Y-%m-%d %H:%M:%S %Z')"
  log "  ACTION REQUIRED: Manual intervention needed immediately!"
  log "============================================================"

  send_webhook "🚨 CRITICAL: KUCET CMS rollback to ${TARGET_COMMIT:0:8} FAILED. Health check still failing after ${ROLLBACK_DURATION}s. MANUAL INTERVENTION REQUIRED."
  # Exit 2 = critical: do NOT loop forever
  exit 2
fi

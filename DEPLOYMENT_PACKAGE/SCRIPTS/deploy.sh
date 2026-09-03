#!/usr/bin/env bash
# =============================================================================
# deploy.sh
# Main production deployment script. Called by GitHub Actions on push to main.
#
# Usage:
#   bash deploy.sh [--commit <SHA>] [--branch <BRANCH>]
#
# This script:
#   1. Logs all output to a timestamped deploy log
#   2. Pulls latest code
#   3. Runs database migrations
#   4. Rebuilds and restarts only the app container
#   5. Validates nginx config and reloads proxy
#   6. Runs health check — rolls back automatically on failure
#   7. Writes a JSON deployment record
# =============================================================================
set -eu
set -o pipefail 2>/dev/null || true

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
KUCET_CMS_DIR="/var/www/kucet-cms"
COMPOSE_FILE="$KUCET_CMS_DIR/DEPLOYMENT_PACKAGE/docker-compose.yml"
SCRIPTS_DIR="$KUCET_CMS_DIR/DEPLOYMENT_PACKAGE/SCRIPTS"
HEALTH_CHECK="$SCRIPTS_DIR/health-check.sh"
ROLLBACK_SCRIPT="$SCRIPTS_DIR/rollback.sh"
PREPARE_STORAGE="$SCRIPTS_DIR/prepare-storage.sh"
LOG_DIR="/var/log/kucet"
DEPLOY_LOG="$LOG_DIR/deploy_$(date +%Y%m%d_%H%M%S).log"
DEPLOYMENTS_JSON="$LOG_DIR/deployments.json"

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
COMMIT_SHA="${GITHUB_SHA:-unknown}"
BRANCH="${BRANCH:-main}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --commit) COMMIT_SHA="$2"; shift 2 ;;
    --branch) BRANCH="$2";     shift 2 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

# ---------------------------------------------------------------------------
# Setup log dir and tee all output to deploy log
# ---------------------------------------------------------------------------
mkdir -p "$LOG_DIR"
# From this point on, all stdout/stderr goes to both terminal AND log file
exec > >(tee -a "$DEPLOY_LOG") 2>&1

# ---------------------------------------------------------------------------
# Logging helper
# ---------------------------------------------------------------------------
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$DEPLOY_LOG"; }

DEPLOY_START=$(date +%s)
DEPLOY_STATUS="success"
ROLLBACK_TRIGGERED=false

log "============================================================"
log "  KUCET CMS — Production Deployment Starting"
log "============================================================"
log "  Deploy log   : $DEPLOY_LOG"
log "  Commit SHA   : $COMMIT_SHA"
log "  Branch       : $BRANCH"
log "  Start time   : $(date '+%Y-%m-%d %H:%M:%S %Z')"
log "  CMS dir      : $KUCET_CMS_DIR"
log "============================================================"

# ---------------------------------------------------------------------------
# Load .env.production variables into environment
# ---------------------------------------------------------------------------
ENV_FILE="$KUCET_CMS_DIR/.env.production"
if [[ -f "$ENV_FILE" ]]; then
  log "Loading environment from $ENV_FILE ..."
  set -a
  # shellcheck disable=SC1090
  source <(tr -d '\r' < "$ENV_FILE")
  set +a
  log "Environment loaded."
else
  log "WARNING: $ENV_FILE not found — proceeding without it."
fi

# ---------------------------------------------------------------------------
# Capture current commit for rollback
# ---------------------------------------------------------------------------
cd "$KUCET_CMS_DIR"
PREV_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
log "Previous commit (rollback target): $PREV_COMMIT"

# ---------------------------------------------------------------------------
# Pull latest code
# ---------------------------------------------------------------------------
log "Pulling latest code from origin/$BRANCH ..."
git fetch origin "$BRANCH" 2>&1
git reset --hard "origin/$BRANCH" 2>&1
git clean -fd 2>&1
NEW_COMMIT=$(git rev-parse HEAD)
log "Code updated: $PREV_COMMIT → $NEW_COMMIT"
chmod +x "$SCRIPTS_DIR"/*.sh 2>/dev/null || true

# ---------------------------------------------------------------------------
# Create automated pre-migration database snapshot
# ---------------------------------------------------------------------------
log "Creating automated pre-migration database snapshot ..."
BACKUP_SCRIPT="$SCRIPTS_DIR/nightly-backup.sh"
if [[ -f "$BACKUP_SCRIPT" ]]; then
  bash "$BACKUP_SCRIPT" 2>&1 || log "WARNING: Pre-migration database backup returned non-zero. Continuing with migration."
fi

# ---------------------------------------------------------------------------
# Run database migrations
# ---------------------------------------------------------------------------
log "Running database migrations ..."
  MIGRATE_HOST=127.0.0.1 npm run db:migrate 2>&1 && \
  log "Database migrations completed successfully." || {
  log "ERROR: Database migrations failed! Aborting deployment."
  DEPLOY_STATUS="failed:migrations"
  exit 1
}

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
  chmod 755 /var/kucet-db-backup 2>/dev/null || true
  chown 1001:1001 /var/www/kucet-storage /var/www/kucet-storage/kucet /var/kucet-db-backup 2>/dev/null || sudo chown 1001:1001 /var/www/kucet-storage /var/www/kucet-storage/kucet /var/kucet-db-backup 2>/dev/null || true
fi

# ---------------------------------------------------------------------------
# Build and start app and realtime containers
# ---------------------------------------------------------------------------
log "Building and starting app and realtime containers ..."
docker compose \
  -p deployment_package \
  -f "$COMPOSE_FILE" \
  --env-file "$ENV_FILE" \
  up -d --build --no-deps app realtime 2>&1

log "App and realtime container build and start initiated."

# ---------------------------------------------------------------------------
# Wait for app and realtime container health (up to 60 seconds)
# ---------------------------------------------------------------------------
log "Waiting for app and realtime containers to become healthy (max 60s) ..."
WAIT_MAX=60
WAIT_INTERVAL=5
WAITED=0
SERVICES_HEALTHY=false

while [[ $WAITED -lt $WAIT_MAX ]]; do
  APP_STATE=$(docker inspect --format='{{.State.Status}}' kucet-cms-app 2>/dev/null || echo "missing")
  APP_HEALTH=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' kucet-cms-app 2>/dev/null || echo "unknown")
  RT_STATE=$(docker inspect --format='{{.State.Status}}' kucet-cms-realtime 2>/dev/null || echo "missing")
  RT_HEALTH=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' kucet-cms-realtime 2>/dev/null || echo "unknown")

  log "  [${WAITED}s] app=$APP_STATE ($APP_HEALTH) | realtime=$RT_STATE ($RT_HEALTH)"

  APP_OK=false
  RT_OK=false

  if [[ "$APP_STATE" == "running" && ("$APP_HEALTH" == "healthy" || "$APP_HEALTH" == "no-healthcheck") ]]; then
    APP_OK=true
  fi
  if [[ "$RT_STATE" == "running" && ("$RT_HEALTH" == "healthy" || "$RT_HEALTH" == "no-healthcheck") ]]; then
    RT_OK=true
  fi

  if $APP_OK && $RT_OK; then
    SERVICES_HEALTHY=true
    break
  fi

  if [[ "$APP_STATE" == "exited" || "$APP_STATE" == "dead" ]]; then
    log "ERROR: App container exited unexpectedly!"
    docker logs kucet-cms-app --tail 50 2>&1 || true
    break
  fi
  if [[ "$RT_STATE" == "exited" || "$RT_STATE" == "dead" ]]; then
    log "ERROR: Realtime container exited unexpectedly!"
    docker logs kucet-cms-realtime --tail 50 2>&1 || true
    break
  fi

  sleep $WAIT_INTERVAL
  WAITED=$((WAITED + WAIT_INTERVAL))
done

if ! $SERVICES_HEALTHY; then
  log "ERROR: App or Realtime container did not become healthy within ${WAIT_MAX}s."
  DEPLOY_STATUS="failed:container-health"
fi

# ---------------------------------------------------------------------------
# Reload Nginx proxy safely
# ---------------------------------------------------------------------------
log "Validating and reloading Nginx proxy ..."
docker compose -p deployment_package -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-deps nginx 2>&1

if docker exec kucet-cms-proxy nginx -t 2>&1; then
  log "Nginx config is valid. Reloading proxy configuration ..."
  docker exec kucet-cms-proxy nginx -s reload 2>&1 || docker restart kucet-cms-proxy 2>&1
  log "Proxy reloaded successfully."
else
  log "ERROR: Nginx config validation failed! Attempting restart ..."
  docker restart kucet-cms-proxy 2>&1 || true
fi

# ---------------------------------------------------------------------------
# Wait for Nginx proxy to accept HTTP requests on port 80 (up to 20s)
# ---------------------------------------------------------------------------
log "Waiting for Nginx proxy to accept HTTP traffic on port 80 ..."
PROXY_READY=false
for i in $(seq 1 10); do
  HTTP_CHECK=$(curl -so /dev/null -w "%{http_code}" --max-time 3 "http://127.0.0.1:80/api/health" 2>/dev/null || echo "000")
  if [[ "$HTTP_CHECK" == "200" ]]; then
    PROXY_READY=true
    log "Nginx proxy is actively serving HTTP traffic (HTTP 200) after ${i} checks."
    break
  fi
  sleep 2
done

if ! $PROXY_READY; then
  log "WARNING: Proxy did not return 200 during pre-flight check (last status: $HTTP_CHECK)."
fi

# ---------------------------------------------------------------------------
# Run comprehensive health check
# ---------------------------------------------------------------------------
log "Running post-deployment health check ..."
sleep 5  # Brief wait for everything to settle

if bash "$HEALTH_CHECK" 2>&1; then
  log "Health check PASSED ✅"
else
  log "Health check FAILED ❌ — triggering rollback ..."
  DEPLOY_STATUS="failed:health-check"
  ROLLBACK_TRIGGERED=true

  if [[ "$PREV_COMMIT" != "unknown" ]]; then
    bash "$ROLLBACK_SCRIPT" "$PREV_COMMIT" 2>&1 || {
      log "CRITICAL: Rollback script also failed! Manual intervention required."
      DEPLOY_STATUS="failed:rollback-also-failed"
    }
  else
    log "CRITICAL: Cannot rollback — previous commit SHA is unknown."
  fi
fi

# ---------------------------------------------------------------------------
# Calculate duration and log deploy end
# ---------------------------------------------------------------------------
DEPLOY_END=$(date +%s)
DEPLOY_DURATION=$((DEPLOY_END - DEPLOY_START))

log "============================================================"
log "  Deployment complete"
log "  Status   : $DEPLOY_STATUS"
log "  Duration : ${DEPLOY_DURATION}s"
log "  End time : $(date '+%Y-%m-%d %H:%M:%S %Z')"
log "============================================================"

# ---------------------------------------------------------------------------
# Write JSON deployment record (append to deployments.json)
# ---------------------------------------------------------------------------
DEPLOY_RECORD=$(cat <<EOF
{"timestamp":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","branch":"$BRANCH","prev_commit":"$PREV_COMMIT","new_commit":"$NEW_COMMIT","status":"$DEPLOY_STATUS","duration_seconds":$DEPLOY_DURATION,"rollback_triggered":$ROLLBACK_TRIGGERED,"log":"$DEPLOY_LOG"}
EOF
)

# Initialize file with empty JSON array if it doesn't exist
if [[ ! -f "$DEPLOYMENTS_JSON" ]]; then
  echo "[]" > "$DEPLOYMENTS_JSON"
fi

# Append new record using Python (avoids jq dependency)
python3 - <<PYEOF
import json, sys
record = json.loads('''$DEPLOY_RECORD''')
with open("$DEPLOYMENTS_JSON", "r+") as f:
    data = json.load(f)
    data.append(record)
    f.seek(0)
    json.dump(data, f, indent=2)
    f.truncate()
print("Deployment record written to $DEPLOYMENTS_JSON")
PYEOF

# ---------------------------------------------------------------------------
# Final exit code
# ---------------------------------------------------------------------------
if [[ "$DEPLOY_STATUS" == "success" ]]; then
  exit 0
else
  exit 1
fi

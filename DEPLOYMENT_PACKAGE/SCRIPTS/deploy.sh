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
set -euo pipefail

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
KUCET_CMS_DIR="/var/www/kucet-cms"
COMPOSE_FILE="$KUCET_CMS_DIR/DEPLOYMENT_PACKAGE/docker-compose.yml"
SCRIPTS_DIR="$KUCET_CMS_DIR/DEPLOYMENT_PACKAGE/SCRIPTS"
HEALTH_CHECK="$SCRIPTS_DIR/health-check.sh"
ROLLBACK_SCRIPT="$SCRIPTS_DIR/rollback.sh"
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
git fetch --all 2>&1
git checkout "$BRANCH" 2>&1
git pull origin "$BRANCH" 2>&1
NEW_COMMIT=$(git rev-parse HEAD)
log "Code updated: $PREV_COMMIT → $NEW_COMMIT"

# ---------------------------------------------------------------------------
# Run database migrations
# ---------------------------------------------------------------------------
log "Running database migrations ..."
DB_HOST=127.0.0.1 npm run db:migrate 2>&1 && \
  log "Database migrations completed successfully." || {
  log "ERROR: Database migrations failed! Aborting deployment."
  DEPLOY_STATUS="failed:migrations"
  exit 1
}

# ---------------------------------------------------------------------------
# Build and restart ONLY the app container
# ---------------------------------------------------------------------------
log "Removing old app container ..."
docker rm -f kucet-cms-app 2>&1 || true

log "Building and starting app container ..."
docker compose \
  -p deployment_package \
  -f "$COMPOSE_FILE" \
  up -d --build --no-deps app 2>&1

log "App container build and start initiated."

# ---------------------------------------------------------------------------
# Wait for app container health (up to 60 seconds, check every 5s)
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
    log "ERROR: App container exited unexpectedly!"
    docker logs kucet-cms-app --tail 50 2>&1 || true
    break
  fi

  sleep $WAIT_INTERVAL
  WAITED=$((WAITED + WAIT_INTERVAL))
done

if ! $APP_HEALTHY; then
  log "ERROR: App container did not become healthy within ${WAIT_MAX}s."
  DEPLOY_STATUS="failed:container-health"
fi

# ---------------------------------------------------------------------------
# Reconnect app container to network with alias (if needed)
# ---------------------------------------------------------------------------
log "Ensuring app container is connected to cms-network with alias 'app' ..."
docker network connect deployment_package_cms-network kucet-cms-app --alias app 2>&1 || true
log "Network connectivity confirmed."

# ---------------------------------------------------------------------------
# Reload Nginx proxy
# ---------------------------------------------------------------------------
log "Validating nginx configuration ..."
if docker exec kucet-cms-proxy nginx -t 2>&1; then
  log "Nginx config is valid. Restarting proxy container ..."
  docker restart kucet-cms-proxy 2>&1
  log "Proxy restarted."
else
  log "ERROR: Nginx config validation failed! Proxy NOT restarted."
  DEPLOY_STATUS="failed:nginx-config"
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

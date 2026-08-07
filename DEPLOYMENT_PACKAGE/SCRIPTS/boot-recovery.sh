#!/usr/bin/env bash
# =============================================================================
# boot-recovery.sh
# Post-reboot recovery verification script.
# Ensures all Docker containers and the GitHub runner are healthy after a
# server restart. Designed to run via @reboot cron.
#
# Usage: bash boot-recovery.sh
# =============================================================================
set -euo pipefail

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
KUCET_CMS_DIR="/var/www/kucet-cms"
COMPOSE_FILE="$KUCET_CMS_DIR/DEPLOYMENT_PACKAGE/docker-compose.yml"
SCRIPTS_DIR="$KUCET_CMS_DIR/DEPLOYMENT_PACKAGE/SCRIPTS"
LOG_FILE="/var/log/kucet/boot-recovery.log"
HEALTH_ENDPOINT="http://localhost/api/health"
DOCKER_WAIT_MAX=120   # Max seconds to wait for Docker daemon
APP_HEALTH_MAX=90     # Max seconds to wait for app health

# ---------------------------------------------------------------------------
# Ensure log directory exists (may not exist yet on first boot)
# ---------------------------------------------------------------------------
mkdir -p /var/log/kucet
touch "$LOG_FILE"

# ---------------------------------------------------------------------------
# Logging helper
# ---------------------------------------------------------------------------
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

BOOT_START=$(date +%s)

log "============================================================"
log "  KUCET CMS — Boot Recovery Script"
log "  Server: $(hostname)"
log "  Kernel: $(uname -r)"
log "  Boot time: $(date '+%Y-%m-%d %H:%M:%S %Z')"
log "============================================================"

# ---------------------------------------------------------------------------
# STEP 1: Wait for Docker daemon to be ready
# ---------------------------------------------------------------------------
log "STEP 1: Waiting for Docker daemon to become ready (max ${DOCKER_WAIT_MAX}s) ..."
WAITED=0
DOCKER_READY=false

while [[ $WAITED -lt $DOCKER_WAIT_MAX ]]; do
  if docker info > /dev/null 2>&1; then
    DOCKER_READY=true
    log "  Docker daemon is ready after ${WAITED}s."
    break
  fi
  log "  [${WAITED}s] Docker daemon not ready yet — waiting ..."
  sleep 5
  WAITED=$((WAITED + 5))
done

if ! $DOCKER_READY; then
  log "CRITICAL: Docker daemon did not become ready within ${DOCKER_WAIT_MAX}s!"
  log "          Check: systemctl status docker"
  exit 1
fi

# ---------------------------------------------------------------------------
# STEP 2: Bring up all Docker containers
# ---------------------------------------------------------------------------
log "STEP 2: Bringing up all Docker containers ..."
docker compose \
  -p deployment_package \
  -f "$COMPOSE_FILE" \
  up -d 2>&1 | tee -a "$LOG_FILE"

log "  docker compose up -d completed."

# ---------------------------------------------------------------------------
# STEP 3: Wait for app /api/health to pass (up to APP_HEALTH_MAX seconds)
# ---------------------------------------------------------------------------
log "STEP 3: Waiting for app health endpoint to respond (max ${APP_HEALTH_MAX}s) ..."
WAITED=0
APP_HEALTHY=false

while [[ $WAITED -lt $APP_HEALTH_MAX ]]; do
  HTTP_STATUS=$(curl -so /dev/null -w "%{http_code}" --max-time 10 "$HEALTH_ENDPOINT" 2>/dev/null || echo "000")
  if [[ "$HTTP_STATUS" == "200" ]]; then
    APP_HEALTHY=true
    log "  App health check PASSED (HTTP 200) after ${WAITED}s."
    break
  fi
  log "  [${WAITED}s] /api/health returned HTTP $HTTP_STATUS — waiting ..."
  sleep 5
  WAITED=$((WAITED + 5))
done

if ! $APP_HEALTHY; then
  log "WARNING: App did not respond with HTTP 200 within ${APP_HEALTH_MAX}s."
  log "         Continuing to check runner — app may still be starting."
fi

# ---------------------------------------------------------------------------
# STEP 4: Verify GitHub Actions runner service is active
# ---------------------------------------------------------------------------
log "STEP 4: Verifying GitHub Actions runner service ..."
RUNNER_UNIT=$(systemctl list-units --type=service --all 2>/dev/null \
  | grep -oP 'actions\.runner\.[^\s]+\.service' | head -1 || true)

RUNNER_OK=false
if [[ -n "$RUNNER_UNIT" ]]; then
  RUNNER_STATE=$(systemctl is-active "$RUNNER_UNIT" 2>/dev/null || echo "inactive")
  if [[ "$RUNNER_STATE" == "active" ]]; then
    log "  [OK] $RUNNER_UNIT is active."
    RUNNER_OK=true
  else
    log "  [WARN] $RUNNER_UNIT is $RUNNER_STATE — attempting start ..."
    systemctl start "$RUNNER_UNIT" 2>&1 | tee -a "$LOG_FILE" || \
      log "  [ERROR] Failed to start $RUNNER_UNIT!"
    # Recheck
    sleep 3
    RUNNER_STATE=$(systemctl is-active "$RUNNER_UNIT" 2>/dev/null || echo "inactive")
    if [[ "$RUNNER_STATE" == "active" ]]; then
      log "  [OK] $RUNNER_UNIT started successfully."
      RUNNER_OK=true
    else
      log "  [ERROR] $RUNNER_UNIT still not active after start attempt."
    fi
  fi
else
  log "  [WARN] No actions.runner.* service unit found."
fi

# ---------------------------------------------------------------------------
# STEP 5: Run full health check if available
# ---------------------------------------------------------------------------
HEALTH_CHECK_RESULT="skipped"
if [[ -f "$SCRIPTS_DIR/health-check.sh" ]]; then
  log "STEP 5: Running comprehensive health check ..."
  if bash "$SCRIPTS_DIR/health-check.sh" 2>&1 | tee -a "$LOG_FILE"; then
    HEALTH_CHECK_RESULT="passed"
    log "  Full health check PASSED ✅"
  else
    HEALTH_CHECK_RESULT="failed"
    log "  Full health check FAILED ❌"
  fi
else
  log "STEP 5: health-check.sh not found — skipping full health check."
fi

# ---------------------------------------------------------------------------
# Print comprehensive summary
# ---------------------------------------------------------------------------
BOOT_END=$(date +%s)
BOOT_DURATION=$((BOOT_END - BOOT_START))

log "============================================================"
log "  Boot Recovery Summary"
log "============================================================"
log "  Docker daemon ready   : $( $DOCKER_READY && echo YES || echo NO )"
log "  Containers started    : YES (docker compose up -d ran)"
log "  App health (HTTP 200) : $( $APP_HEALTHY && echo PASS || echo WARN — still starting )"
log "  GitHub runner active  : $( $RUNNER_OK && echo YES || echo NO )"
log "  Full health check     : $HEALTH_CHECK_RESULT"
log "  Total duration        : ${BOOT_DURATION}s"
log "  Completed at          : $(date '+%Y-%m-%d %H:%M:%S %Z')"
log "============================================================"

# Exit with failure only if critical systems didn't come up
if ! $DOCKER_READY; then
  exit 1
fi

if [[ "$HEALTH_CHECK_RESULT" == "failed" ]]; then
  log "WARNING: Boot recovery completed with health check failures."
  exit 1
fi

log "Boot recovery completed successfully."
exit 0

#!/usr/bin/env bash
# =============================================================================
# boot-recovery.sh
# Post-reboot recovery verification script for KUCET CMS.
# Ensures Docker containers, Tailscale Funnel ingress, and GitHub runner
# automatically self-heal and become healthy after a server reboot or power outage.
# Designed to run via @reboot cron or systemd unit.
#
# Usage: bash boot-recovery.sh
# =============================================================================
set -eu
set -o pipefail 2>/dev/null || true

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
KUCET_CMS_DIR="/var/www/kucet-cms"
COMPOSE_FILE="$KUCET_CMS_DIR/DEPLOYMENT_PACKAGE/docker-compose.yml"
SCRIPTS_DIR="$KUCET_CMS_DIR/DEPLOYMENT_PACKAGE/SCRIPTS"
LOG_FILE="/var/log/kucet/boot-recovery.log"
LOCAL_HEALTH_ENDPOINT="http://localhost/api/health"
PUBLIC_HOSTNAME="kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc.tailf6b4a7.ts.net"
PUBLIC_HEALTH_ENDPOINT="https://${PUBLIC_HOSTNAME}/api/health"
DOCKER_WAIT_MAX=120    # Max seconds to wait for Docker daemon
APP_HEALTH_MAX=90      # Max seconds to wait for app health
FUNNEL_WAIT_MAX=45     # Max seconds to wait for Funnel ingress

# ---------------------------------------------------------------------------
# Ensure log directory exists
# ---------------------------------------------------------------------------
mkdir -p /var/log/kucet
touch "$LOG_FILE"

# ---------------------------------------------------------------------------
# Logging helper
# ---------------------------------------------------------------------------
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

BOOT_START=$(date +%s)

log "============================================================"
log "  KUCET CMS — Boot Recovery & Self-Healing Script"
log "  Server: $(hostname)"
log "  Kernel: $(uname -r)"
log "  Boot time: $(date '+%Y-%m-%d %H:%M:%S %Z')"
log "============================================================"

# ---------------------------------------------------------------------------
# STEP 1: Verify Host Sleep Masking (Prevent Desktop NIC sleep)
# ---------------------------------------------------------------------------
log "STEP 1: Verifying server power management / sleep masking ..."
if command -v systemctl >/dev/null 2>&1; then
  for target in sleep.target suspend.target hibernate.target hybrid-sleep.target; do
    status=$(systemctl is-enabled "$target" 2>/dev/null || echo "unknown")
    if [[ "$status" != "masked" ]]; then
      log "  [WARN] $target is not masked ($status) — masking target ..."
      systemctl mask "$target" 2>/dev/null || true
    else
      log "  [OK] $target is masked."
    fi
  done
fi

# ---------------------------------------------------------------------------
# STEP 2: Wait for Docker daemon to be ready
# ---------------------------------------------------------------------------
log "STEP 2: Waiting for Docker daemon to become ready (max ${DOCKER_WAIT_MAX}s) ..."
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
# STEP 3: Bring up all Docker containers with self-healing policies
# ---------------------------------------------------------------------------
log "STEP 3: Bringing up all Docker containers (docker compose up -d) ..."
docker compose \
  -p deployment_package \
  -f "$COMPOSE_FILE" \
  --env-file "$KUCET_CMS_DIR/.env.production" \
  up -d 2>&1 | tee -a "$LOG_FILE"

log "  docker compose up -d completed."

# ---------------------------------------------------------------------------
# STEP 4: Wait for local /api/health to pass (up to APP_HEALTH_MAX seconds)
# ---------------------------------------------------------------------------
log "STEP 4: Waiting for local app health endpoint to respond (max ${APP_HEALTH_MAX}s) ..."
WAITED=0
APP_HEALTHY=false

while [[ $WAITED -lt $APP_HEALTH_MAX ]]; do
  HTTP_STATUS=$(curl -so /dev/null -w "%{http_code}" --max-time 10 "$LOCAL_HEALTH_ENDPOINT" 2>/dev/null || echo "000")
  if [[ "$HTTP_STATUS" == "200" ]]; then
    APP_HEALTHY=true
    log "  Local app health check PASSED (HTTP 200) after ${WAITED}s."
    break
  fi
  log "  [${WAITED}s] /api/health returned HTTP $HTTP_STATUS — waiting ..."
  sleep 5
  WAITED=$((WAITED + 5))
done

if ! $APP_HEALTHY; then
  log "WARNING: App did not respond with HTTP 200 within ${APP_HEALTH_MAX}s."
  log "         Continuing to check ingress and runner — app may still be starting."
fi

# ---------------------------------------------------------------------------
# STEP 5: Verify Tailscale Daemon & Restore Tailscale Funnel Public Ingress
# ---------------------------------------------------------------------------
log "STEP 5: Verifying Tailscale service & Public Funnel HTTPS ingress ..."
TAILSCALE_OK=false
FUNNEL_OK=false

if command -v tailscale >/dev/null 2>&1; then
  # Ensure tailscaled service is running
  if systemctl is-active tailscaled >/dev/null 2>&1; then
    log "  [OK] tailscaled service is active."
  else
    log "  [WARN] tailscaled is inactive — attempting restart ..."
    systemctl restart tailscaled 2>&1 | tee -a "$LOG_FILE" || true
    sleep 3
  fi

  # Check Tailscale IP
  TS_IP=$(tailscale ip -4 2>/dev/null || echo "")
  if [[ -n "$TS_IP" ]]; then
    log "  [OK] Tailscale connected with IP: $TS_IP"
    TAILSCALE_OK=true

    # Ensure Funnel is actively proxying to local Nginx on port 80
    log "  Configuring/Verifying Tailscale Funnel (https://127.0.0.1:80) ..."
    tailscale funnel --bg http://127.0.0.1:80 2>&1 | tee -a "$LOG_FILE" || \
      sudo tailscale funnel --bg http://127.0.0.1:80 2>&1 | tee -a "$LOG_FILE" || \
      log "  [WARN] Tailscale funnel command returned non-zero. Check tailscale permissions."

    # Test public HTTPS endpoint
    log "  Testing public Funnel endpoint (${PUBLIC_HEALTH_ENDPOINT}) ..."
    WAITED=0
    while [[ $WAITED -lt $FUNNEL_WAIT_MAX ]]; do
      PUB_STATUS=$(curl -so /dev/null -w "%{http_code}" --max-time 10 "$PUBLIC_HEALTH_ENDPOINT" 2>/dev/null || echo "000")
      if [[ "$PUB_STATUS" == "200" ]]; then
        FUNNEL_OK=true
        log "  Public Funnel endpoint PASSED (HTTP 200) after ${WAITED}s."
        break
      fi
      log "  [${WAITED}s] Public endpoint returned HTTP $PUB_STATUS — waiting for DNS/TLS ..."
      sleep 5
      WAITED=$((WAITED + 5))
    done

    if ! $FUNNEL_OK; then
      log "  [WARN] Public Funnel endpoint did not return 200 within ${FUNNEL_WAIT_MAX}s (returned $PUB_STATUS)."
    fi
  else
    log "  [ERROR] Tailscale IP unavailable. Machine may be logged out of tailnet."
  fi
else
  log "  [WARN] tailscale CLI not found in PATH."
fi

# ---------------------------------------------------------------------------
# STEP 6: Verify GitHub Actions runner service is active
# ---------------------------------------------------------------------------
log "STEP 6: Verifying GitHub Actions runner service ..."
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
    sleep 3
    RUNNER_STATE=$(systemctl is-active "$RUNNER_UNIT" 2>/dev/null || echo "inactive")
    if [[ "$RUNNER_STATE" == "active" ]]; then
      log "  [OK] $RUNNER_UNIT started successfully."
      RUNNER_OK=true
    fi
  fi
else
  log "  [WARN] No actions.runner.* service unit found."
fi

# ---------------------------------------------------------------------------
# STEP 7: Run full health check
# ---------------------------------------------------------------------------
HEALTH_CHECK_RESULT="skipped"
if [[ -f "$SCRIPTS_DIR/health-check.sh" ]]; then
  log "STEP 7: Running comprehensive health check ..."
  if bash "$SCRIPTS_DIR/health-check.sh" 2>&1 | tee -a "$LOG_FILE"; then
    HEALTH_CHECK_RESULT="passed"
    log "  Full health check PASSED ✅"
  else
    HEALTH_CHECK_RESULT="failed"
    log "  Full health check FAILED ❌"
  fi
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
BOOT_END=$(date +%s)
BOOT_DURATION=$((BOOT_END - BOOT_START))

log "============================================================"
log "  Boot Recovery Summary"
log "============================================================"
log "  Docker daemon ready    : $( $DOCKER_READY && echo YES || echo NO )"
log "  Containers started     : YES (docker compose up -d ran)"
log "  Local app health (200) : $( $APP_HEALTHY && echo PASS || echo WARN )"
log "  Tailscale connected    : $( $TAILSCALE_OK && echo YES || echo NO )"
log "  Public Funnel reachable: $( $FUNNEL_OK && echo PASS || echo WARN )"
log "  GitHub runner active   : $( $RUNNER_OK && echo YES || echo NO )"
log "  Full health check      : $HEALTH_CHECK_RESULT"
log "  Total duration         : ${BOOT_DURATION}s"
log "  Completed at           : $(date '+%Y-%m-%d %H:%M:%S %Z')"
log "============================================================"

if ! $DOCKER_READY; then
  exit 1
fi

log "Boot recovery completed."
exit 0

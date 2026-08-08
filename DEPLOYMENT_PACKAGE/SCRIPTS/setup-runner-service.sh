#!/usr/bin/env bash
# =============================================================================
# setup-runner-service.sh
# One-time setup: Installs the GitHub Actions self-hosted runner as a systemd
# service so it survives reboots and is managed by the OS.
#
# Usage: sudo bash setup-runner-service.sh
# Must be run as root (or with sudo) to interact with systemd.
# =============================================================================
set -euo pipefail

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
KUCET_CMS_DIR="/var/www/kucet-cms"
COMPOSE_FILE="$KUCET_CMS_DIR/DEPLOYMENT_PACKAGE/docker-compose.yml"
RUNNER_DIR="/home/deployer/actions-runner"
LOG_FILE="/var/log/kucet/setup-runner-service.log"

# ---------------------------------------------------------------------------
# Logging helper
# ---------------------------------------------------------------------------
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

# ---------------------------------------------------------------------------
# Ensure log directory exists
# ---------------------------------------------------------------------------
mkdir -p /var/log/kucet
touch "$LOG_FILE"

log "============================================================"
log "  GitHub Actions Runner → systemd Service Setup"
log "============================================================"

# ---------------------------------------------------------------------------
# Guard: must run as root
# ---------------------------------------------------------------------------
if [[ "$EUID" -ne 0 ]]; then
  log "ERROR: This script must be run as root (use sudo)."
  exit 1
fi

# ---------------------------------------------------------------------------
# Guard: runner directory and svc.sh must exist
# ---------------------------------------------------------------------------
if [[ ! -f "$RUNNER_DIR/svc.sh" ]]; then
  log "ERROR: Runner service installer not found at $RUNNER_DIR/svc.sh"
  log "       Please complete the GitHub Actions runner registration first:"
  log "       https://github.com/your-org/your-repo/settings/actions/runners"
  exit 1
fi

log "Found runner service installer at: $RUNNER_DIR/svc.sh"

# ---------------------------------------------------------------------------
# Stop any manually running run.sh process gracefully
# ---------------------------------------------------------------------------
log "Checking for manually running runner process (./run.sh) ..."
if pgrep -f "$RUNNER_DIR/run.sh" > /dev/null 2>&1; then
  log "Detected running ./run.sh process — sending SIGTERM for graceful stop ..."
  pkill -SIGTERM -f "$RUNNER_DIR/run.sh" || true
  # Give it up to 15 seconds to shut down gracefully
  for i in $(seq 1 15); do
    if ! pgrep -f "$RUNNER_DIR/run.sh" > /dev/null 2>&1; then
      log "Runner process stopped gracefully after ${i}s."
      break
    fi
    sleep 1
  done
  # Force-kill if still running
  if pgrep -f "$RUNNER_DIR/run.sh" > /dev/null 2>&1; then
    log "WARNING: Runner did not stop gracefully — sending SIGKILL ..."
    pkill -SIGKILL -f "$RUNNER_DIR/run.sh" || true
    sleep 2
  fi
else
  log "No manually running runner process detected."
fi

# ---------------------------------------------------------------------------
# Install the runner as a systemd service (runner's own installer)
# ---------------------------------------------------------------------------
log "Installing runner as systemd service via ./svc.sh install ..."
cd "$RUNNER_DIR"

# svc.sh install must be run from within the runner directory
sudo -u deployer bash svc.sh install deployer 2>&1 | tee -a "$LOG_FILE" || {
  # Some runner versions do not accept a user argument — retry without it
  log "Retrying svc.sh install without user argument ..."
  bash svc.sh install 2>&1 | tee -a "$LOG_FILE"
}

log "Runner systemd service installed successfully."

# ---------------------------------------------------------------------------
# Start the runner service
# ---------------------------------------------------------------------------
log "Starting runner service via ./svc.sh start ..."
bash svc.sh start 2>&1 | tee -a "$LOG_FILE"
log "Runner service started."

# ---------------------------------------------------------------------------
# Enable auto-start on reboot for all runner-related units
# ---------------------------------------------------------------------------
log "Enabling runner service to auto-start on reboot ..."

# The service name pattern varies by repo/org; match with a glob
RUNNER_SERVICE=$(systemctl list-units --type=service --all | grep -oP 'actions\.runner\.[^\s]+\.service' | head -1 || true)

if [[ -n "$RUNNER_SERVICE" ]]; then
  log "Detected runner service unit: $RUNNER_SERVICE"
  systemctl enable "$RUNNER_SERVICE" 2>&1 | tee -a "$LOG_FILE"
  log "Enabled: $RUNNER_SERVICE"
else
  # Fallback: enable by glob pattern (works on most Ubuntu versions)
  log "Could not detect exact service name — enabling via glob pattern ..."
  systemctl enable "actions.runner.*" 2>&1 | tee -a "$LOG_FILE" || true
fi

# ---------------------------------------------------------------------------
# Enable Docker and containerd services
# ---------------------------------------------------------------------------
log "Enabling docker.service to auto-start on reboot ..."
systemctl enable docker.service 2>&1 | tee -a "$LOG_FILE"
log "docker.service enabled."

log "Enabling containerd.service to auto-start on reboot ..."
systemctl enable containerd.service 2>&1 | tee -a "$LOG_FILE"
log "containerd.service enabled."

# ---------------------------------------------------------------------------
# Final status report
# ---------------------------------------------------------------------------
log "============================================================"
log "  Final Status Report"
log "============================================================"

log "--- Docker service status ---"
systemctl status docker.service --no-pager 2>&1 | tee -a "$LOG_FILE" || true

log "--- containerd service status ---"
systemctl status containerd.service --no-pager 2>&1 | tee -a "$LOG_FILE" || true

log "--- GitHub Actions Runner service status ---"
if [[ -n "${RUNNER_SERVICE:-}" ]]; then
  systemctl status "$RUNNER_SERVICE" --no-pager 2>&1 | tee -a "$LOG_FILE" || true
else
  systemctl status "actions.runner.*" --no-pager 2>&1 | tee -a "$LOG_FILE" || true
fi

log "============================================================"
log "  setup-runner-service.sh completed successfully."
log "  Log saved to: $LOG_FILE"
log "============================================================"

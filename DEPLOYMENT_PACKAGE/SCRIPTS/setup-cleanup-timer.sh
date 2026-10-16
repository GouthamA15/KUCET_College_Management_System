#!/usr/bin/env bash
# =============================================================================
# setup-cleanup-timer.sh
# Installs and enables the systemd service and timer for KUCET CMS
# automated nightly cleanup (runs at 00:00:00 IST daily).
#
# Usage: sudo bash setup-cleanup-timer.sh
# =============================================================================
set -eu
set -o pipefail 2>/dev/null || true

KUCET_CMS_DIR="${KUCET_CMS_DIR:-/var/www/kucet-cms}"
CONFIGS_DIR="$KUCET_CMS_DIR/DEPLOYMENT_PACKAGE/CONFIGS/systemd"
SYSTEMD_DIR="/etc/systemd/system"
LOG_FILE="/var/log/kucet/setup-cleanup-timer.log"

mkdir -p /var/log/kucet
touch "$LOG_FILE"
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

log "============================================================"
log "  KUCET CMS — Nightly Cleanup Systemd Timer Setup"
log "============================================================"

if [[ "$EUID" -ne 0 ]]; then
  log "ERROR: This script must be run as root (use sudo)."
  exit 1
fi

SERVICE_SRC="$CONFIGS_DIR/kucet-nightly-cleanup.service"
TIMER_SRC="$CONFIGS_DIR/kucet-nightly-cleanup.timer"
SERVICE_DEST="$SYSTEMD_DIR/kucet-nightly-cleanup.service"
TIMER_DEST="$SYSTEMD_DIR/kucet-nightly-cleanup.timer"

if [[ ! -f "$SERVICE_SRC" || ! -f "$TIMER_SRC" ]]; then
  log "ERROR: Unit files not found in $CONFIGS_DIR"
  exit 1
fi

log "Installing unit files to $SYSTEMD_DIR ..."
cp "$SERVICE_SRC" "$SERVICE_DEST"
cp "$TIMER_SRC" "$TIMER_DEST"
chmod 0644 "$SERVICE_DEST" "$TIMER_DEST"

log "Reloading systemd daemon ..."
systemctl daemon-reload

log "Enabling and starting kucet-nightly-cleanup.timer ..."
systemctl enable --now kucet-nightly-cleanup.timer

# Invariant: Ensure ONLY ONE active scheduler (purge from crontab if present)
if crontab -l 2>/dev/null | grep -q "nightly-cleanup.sh"; then
  log "Removing duplicate cleanup entry from crontab to preserve single-scheduler invariant ..."
  crontab -l | grep -v "nightly-cleanup.sh" | crontab - || true
fi

log "Verifying timer status ..."
systemctl status kucet-nightly-cleanup.timer --no-pager 2>&1 | tee -a "$LOG_FILE"

log "Next timer elapses:"
systemctl list-timers --all | grep -E "(UNIT|kucet-nightly-cleanup)" | tee -a "$LOG_FILE" || true

log "============================================================"
log "  setup-cleanup-timer.sh completed successfully."
log "============================================================"

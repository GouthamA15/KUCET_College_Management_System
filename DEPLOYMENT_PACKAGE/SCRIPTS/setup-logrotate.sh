#!/usr/bin/env bash
# =============================================================================
# setup-logrotate.sh
# One-time setup: Installs the logrotate configuration for KUCET CMS logs.
#
# Usage: sudo bash setup-logrotate.sh
# Must be run as root to write to /etc/logrotate.d/
# =============================================================================
set -eu
set -o pipefail 2>/dev/null || true

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
KUCET_CMS_DIR="/var/www/kucet-cms"
COMPOSE_FILE="$KUCET_CMS_DIR/DEPLOYMENT_PACKAGE/docker-compose.yml"
LOGROTATE_CONFIG_SRC="$KUCET_CMS_DIR/DEPLOYMENT_PACKAGE/CONFIGS/logrotate/kucet-cms"
LOGROTATE_CONFIG_DEST="/etc/logrotate.d/kucet-cms"
LOG_FILE="/var/log/kucet/setup-logrotate.log"

# ---------------------------------------------------------------------------
# Logging helper
# ---------------------------------------------------------------------------
mkdir -p /var/log/kucet
touch "$LOG_FILE"
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

log "============================================================"
log "  KUCET CMS — Logrotate Setup"
log "============================================================"

# ---------------------------------------------------------------------------
# Guard: must run as root
# ---------------------------------------------------------------------------
if [[ "$EUID" -ne 0 ]]; then
  log "ERROR: This script must be run as root (use sudo)."
  exit 1
fi

# ---------------------------------------------------------------------------
# Ensure /var/log/kucet exists
# ---------------------------------------------------------------------------
log "Ensuring /var/log/kucet/ directory exists ..."
mkdir -p /var/log/kucet
log "Directory ready: /var/log/kucet/"

# ---------------------------------------------------------------------------
# Write logrotate config (from repo source if available, otherwise inline)
# ---------------------------------------------------------------------------
if [[ -f "$LOGROTATE_CONFIG_SRC" ]]; then
  log "Copying logrotate config from repo: $LOGROTATE_CONFIG_SRC"
  cp "$LOGROTATE_CONFIG_SRC" "$LOGROTATE_CONFIG_DEST"
else
  log "Repo config not found — writing inline logrotate config ..."
  cat > "$LOGROTATE_CONFIG_DEST" <<'EOF'
/var/log/kucet/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
    dateext
    dateformat -%Y%m%d
}
EOF
fi

log "Logrotate config written to: $LOGROTATE_CONFIG_DEST"

# ---------------------------------------------------------------------------
# Set correct permissions (logrotate requires 0644 or 0600 for security)
# ---------------------------------------------------------------------------
chmod 0644 "$LOGROTATE_CONFIG_DEST"
log "Permissions set: 0644 on $LOGROTATE_CONFIG_DEST"

# ---------------------------------------------------------------------------
# Verify logrotate syntax
# ---------------------------------------------------------------------------
log "Verifying logrotate configuration syntax ..."
logrotate --debug "$LOGROTATE_CONFIG_DEST" 2>&1 | tee -a "$LOG_FILE"
log "Logrotate syntax verification complete."

# ---------------------------------------------------------------------------
# Test run (dry-run, won't actually rotate)
# ---------------------------------------------------------------------------
log "Running logrotate dry-run to confirm config is valid ..."
logrotate -d "$LOGROTATE_CONFIG_DEST" 2>&1 | tee -a "$LOG_FILE" || \
  log "WARNING: Dry-run reported issues (may be non-fatal if no logs exist yet)."

log "============================================================"
log "  setup-logrotate.sh completed successfully."
log "  Config installed at: $LOGROTATE_CONFIG_DEST"
log "  Logs in /var/log/kucet/ will be rotated daily, kept 30 days."
log "============================================================"

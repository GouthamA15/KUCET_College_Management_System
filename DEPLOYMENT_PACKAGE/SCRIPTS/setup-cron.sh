#!/usr/bin/env bash
# =============================================================================
# setup-cron.sh
# One-time setup: Installs all KUCET CMS cron jobs.
# Idempotent — will not add duplicate entries if already present.
#
# Usage: bash setup-cron.sh
# =============================================================================
set -euo pipefail

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
KUCET_CMS_DIR="/var/www/kucet-cms"
COMPOSE_FILE="$KUCET_CMS_DIR/DEPLOYMENT_PACKAGE/docker-compose.yml"
SCRIPTS_DIR="$KUCET_CMS_DIR/DEPLOYMENT_PACKAGE/SCRIPTS"
LOG_FILE="/var/log/kucet/setup-cron.log"

# ---------------------------------------------------------------------------
# Logging helper
# ---------------------------------------------------------------------------
mkdir -p /var/log/kucet
touch "$LOG_FILE"
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

log "============================================================"
log "  KUCET CMS — Cron Jobs Setup"
log "============================================================"

# ---------------------------------------------------------------------------
# Cron entries to install
# Format: "SCHEDULE|COMMAND|DESCRIPTION"
# ---------------------------------------------------------------------------
declare -a CRON_ENTRIES=(
  "*/5 * * * *|$SCRIPTS_DIR/monitor.sh >> /var/log/kucet/monitor-cron.log 2>&1|Monitor: every 5 minutes"
  "30 2 * * *|$SCRIPTS_DIR/nightly-backup.sh >> /var/log/kucet/backup.log 2>&1|Nightly backup: daily at 02:30"
  "0 4 * * *|$SCRIPTS_DIR/offsite-backup.sh >> /var/log/kucet/offsite-backup.log 2>&1|Offsite backup: daily at 04:00"
  "@reboot|$SCRIPTS_DIR/boot-recovery.sh >> /var/log/kucet/boot-recovery.log 2>&1|Boot recovery: on reboot"
)

# ---------------------------------------------------------------------------
# Load existing crontab (if any)
# ---------------------------------------------------------------------------
TMPFILE=$(mktemp /tmp/kucet-crontab-XXXXXX)
crontab -l 2>/dev/null > "$TMPFILE" || true

log "Current crontab loaded ($(wc -l < "$TMPFILE") lines)."

# ---------------------------------------------------------------------------
# Add each cron entry idempotently
# ---------------------------------------------------------------------------
ADDED=0
SKIPPED=0

for entry in "${CRON_ENTRIES[@]}"; do
  # Split on first | — schedule field
  SCHEDULE="${entry%%|*}"
  REST="${entry#*|}"
  # Split on last | — description
  COMMAND="${REST%|*}"
  DESCRIPTION="${REST##*|}"

  FULL_CRON="$SCHEDULE $COMMAND"

  # Check if this command is already in crontab (by script path)
  SCRIPT_PATH=$(echo "$COMMAND" | awk '{print $1}')
  if grep -qF "$SCRIPT_PATH" "$TMPFILE" 2>/dev/null; then
    log "  SKIP (already exists): $DESCRIPTION"
    SKIPPED=$((SKIPPED + 1))
  else
    echo "$FULL_CRON" >> "$TMPFILE"
    log "  ADDED: $DESCRIPTION"
    log "         Schedule: $SCHEDULE"
    log "         Command:  $COMMAND"
    ADDED=$((ADDED + 1))
  fi
done

# ---------------------------------------------------------------------------
# Install updated crontab
# ---------------------------------------------------------------------------
if [[ $ADDED -gt 0 ]]; then
  crontab "$TMPFILE"
  log "Crontab updated: $ADDED entries added, $SKIPPED skipped."
else
  log "Crontab unchanged: all $SKIPPED entries already present."
fi

rm -f "$TMPFILE"

# ---------------------------------------------------------------------------
# Print all active crontab entries
# ---------------------------------------------------------------------------
log "============================================================"
log "  Active crontab entries:"
log "============================================================"
crontab -l 2>/dev/null | tee -a "$LOG_FILE" || log "  (no crontab entries)"

log "============================================================"
log "  setup-cron.sh completed successfully."
log "  $ADDED new cron jobs installed, $SKIPPED already existed."
log "============================================================"

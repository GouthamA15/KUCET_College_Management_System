#!/bin/bash
set -e  # Exit on any error

# Configuration
DB_NAME="kucet_cms"
BACKUP_DIR="/var/kucet-db-backup"
STORAGE_DIR="/var/www/kucet-storage"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
WEBHOOK_URL=${BACKUP_ALERT_WEBHOOK_URL:-""}

send_alert() {
  local message=$1
  if [ -n "$WEBHOOK_URL" ]; then
    local safe_payload=$(jq -n --arg msg "🚨 *BACKUP FAILURE*: $message" '{text: $msg}')
    curl -s -X POST -H 'Content-Type: application/json' -d "$safe_payload" "$WEBHOOK_URL" >/dev/null || true
  fi
}

# Create backup dir if missing
mkdir -p $BACKUP_DIR

echo "Starting Nightly Backup: $TIMESTAMP"

# 1. Database Dump
# NOTE: Ensure you have a .my.cnf file in your root home with:
# [client]
# user=root
# password=your_password
DB_TEMP="$BACKUP_DIR/db_$TIMESTAMP.sql.tmp"
if ! mysqldump $DB_NAME > "$DB_TEMP" 2>/dev/null; then
  echo "ERROR: mysqldump failed for database $DB_NAME at $TIMESTAMP" >&2
  send_alert "mysqldump failed for database $DB_NAME at $TIMESTAMP"
  rm -f "$DB_TEMP"
  exit 1
fi
mv "$DB_TEMP" "$BACKUP_DIR/db_$TIMESTAMP.sql"
echo "Database backup completed: $BACKUP_DIR/db_$TIMESTAMP.sql"

# 2. Storage Sync (Compressing student assets)
if [ ! -d "$STORAGE_DIR" ]; then
  echo "ERROR: STORAGE_DIR does not exist: $STORAGE_DIR" >&2
  send_alert "STORAGE_DIR does not exist: $STORAGE_DIR"
  exit 1
fi

if ! tar -czf "$BACKUP_DIR/assets_$TIMESTAMP.tar.gz" "$STORAGE_DIR" 2>/dev/null; then
  echo "ERROR: tar failed for directory $STORAGE_DIR at $TIMESTAMP" >&2
  send_alert "tar failed for directory $STORAGE_DIR at $TIMESTAMP"
  exit 1
fi
echo "Assets backup completed: $BACKUP_DIR/assets_$TIMESTAMP.tar.gz"

# 3. Off-site Sync to Google Drive (Requires Rclone configured)
# To configure Google Drive, run `rclone config`, create a new remote named 'gdrive', and select 'drive' as the storage type.
# Sync the backups folder to Google Drive
if ! rclone copy "$BACKUP_DIR" gdrive:kucet-backups/archives; then
  echo "ERROR: rclone to Google Drive failed at $TIMESTAMP" >&2
  send_alert "rclone to Google Drive failed at $TIMESTAMP. Check OAuth Refresh Tokens (make sure OAuth consent screen is published to Production)."
  exit 1
fi

# Sync the live assets folder directly to Google Drive (optional, for continuous asset backup)
# rclone sync $STORAGE_DIR gdrive:kucet-backups/live-assets

# 4. Housekeeping (Keep only last 7 days locally, targeting only backup files)
find $BACKUP_DIR -maxdepth 1 -type f \( -name 'db_*.sql' -o -name 'assets_*.tar.gz' \) -mtime +7 -delete
echo "Old backups cleaned up (older than 7 days)"

echo "Backup Complete."

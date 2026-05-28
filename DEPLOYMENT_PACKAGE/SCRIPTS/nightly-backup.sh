#!/bin/bash
set -e  # Exit on any error

# Configuration
DB_NAME="kucet_cms"
BACKUP_DIR="/var/www/backups"
STORAGE_DIR="/var/www/kucet-storage/uploads"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")

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
  rm -f "$DB_TEMP"
  exit 1
fi
mv "$DB_TEMP" "$BACKUP_DIR/db_$TIMESTAMP.sql"
echo "Database backup completed: $BACKUP_DIR/db_$TIMESTAMP.sql"

# 2. Storage Sync (Compressing student assets)
if [ ! -d "$STORAGE_DIR" ]; then
  echo "ERROR: STORAGE_DIR does not exist: $STORAGE_DIR" >&2
  exit 1
fi

if ! tar -czf "$BACKUP_DIR/assets_$TIMESTAMP.tar.gz" "$STORAGE_DIR" 2>/dev/null; then
  echo "ERROR: tar failed for directory $STORAGE_DIR at $TIMESTAMP" >&2
  exit 1
fi
echo "Assets backup completed: $BACKUP_DIR/assets_$TIMESTAMP.tar.gz"

# 3. Off-site Sync (Optional: Requires Rclone configured)
# rclone copy $BACKUP_DIR remote:kucet-backups

# 4. Housekeeping (Keep only last 7 days locally, targeting only backup files)
find $BACKUP_DIR -maxdepth 1 -type f \( -name 'db_*.sql' -o -name 'assets_*.tar.gz' \) -mtime +7 -delete
echo "Old backups cleaned up (older than 7 days)"

echo "Backup Complete."

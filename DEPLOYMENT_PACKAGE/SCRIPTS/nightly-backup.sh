#!/bin/bash

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
mysqldump $DB_NAME > "$BACKUP_DIR/db_$TIMESTAMP.sql"

# 2. Storage Sync (Compressing student assets)
tar -czf "$BACKUP_DIR/assets_$TIMESTAMP.tar.gz" $STORAGE_DIR

# 3. Off-site Sync (Optional: Requires Rclone configured)
# rclone copy $BACKUP_DIR remote:kucet-backups

# 4. Housekeeping (Keep only last 7 days locally)
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup Complete."

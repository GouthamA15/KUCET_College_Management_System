#!/bin/bash
# KUCET CMS: Secure Dockerized Nightly Backup
# This script runs outside the container and triggers a dump from the MySQL container.
# Backups are stored in a secure system directory, outside of any web root.

BACKUP_DIR="/var/kucet-db-backup"
mkdir -p $BACKUP_DIR
# Ensure only root can read this folder
chmod 700 $BACKUP_DIR

TIMESTAMP=$(date +%F_%H-%M-%S)
CONTAINER_NAME="kucet-cms-db"
# Using .sql.gz for better compression in the new secure location
BACKUP_FILE="$BACKUP_DIR/kucet_db_backup_$TIMESTAMP.sql.gz"

echo "[$(date)] Starting secure backup..."

# Trigger mysqldump inside the container, stream it to host, and compress it on the fly
docker exec $CONTAINER_NAME /usr/bin/mysqldump --no-tablespaces -u kucet -p'Kucet@official' kucet_cms | gzip > $BACKUP_FILE

if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo "[$(date)] Backup successful: $BACKUP_FILE"
    
    # Secure the backup file strictly
    chmod 600 $BACKUP_FILE
    
    # Remove backups older than 30 days (handles both new .sql.gz and old .sql.jpg files)
    find $BACKUP_DIR -type f -name "kucet_db_backup_*" -mtime +30 -delete
else
    echo "[$(date)] ERROR: Backup failed!"
    rm -f $BACKUP_FILE # Remove corrupted/empty file
    exit 1
fi

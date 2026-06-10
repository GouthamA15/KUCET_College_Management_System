#!/bin/bash
# KUCET CMS: Secure Dockerized Nightly Backup
# This script runs outside the container and triggers a dump from the MySQL container.
# Backups are stored in a secure system directory, outside of any web root.

BACKUP_DIR="/var/backups/kucet-cms"
mkdir -p $BACKUP_DIR
# Ensure only root can read this folder
chmod 700 $BACKUP_DIR

TIMESTAMP=$(date +%F_%H-%M-%S)
CONTAINER_NAME="kucet-cms-db"
BACKUP_FILE="$BACKUP_DIR/db_$TIMESTAMP.sql.gz"

echo "[$(date)] Starting secure backup..."

# Trigger mysqldump inside the container, stream it to host, and compress it on the fly
docker exec $CONTAINER_NAME /usr/bin/mysqldump -u cms_user -p'cms_secure_password' kucet_cms | gzip > $BACKUP_FILE

if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo "[$(date)] Backup successful: $BACKUP_FILE"
    
    # Secure the backup file strictly
    chmod 600 $BACKUP_FILE
    
    # Remove backups older than 30 days to save space
    find $BACKUP_DIR -type f -name "db_*.sql.gz" -mtime +30 -delete
else
    echo "[$(date)] ERROR: Backup failed!"
    rm -f $BACKUP_FILE # Remove corrupted/empty file
    exit 1
fi

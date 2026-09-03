#!/bin/bash
# KUCET CMS: Offsite Cloud Backup (3-2-1 Rule)
# Uses rclone to sync secure local backups to an encrypted S3 bucket (e.g., Backblaze B2 or Google Drive)

LOCAL_BACKUP_DIR="/var/kucet-db-backup"
REMOTE_NAME="kucet-offsite"  # Configure this in rclone
REMOTE_DIR="cms-backups"

echo "[$(date)] Starting Offsite Sync..."

# Ensure rclone is installed
if ! command -v rclone &> /dev/null; then
    echo "ERROR: rclone not installed. Install with: sudo apt install rclone"
    exit 1
fi

# Sync the local backup folder to the remote cloud storage
# 'copy' adds new files; 'sync' would delete files not present locally
rclone copy $LOCAL_BACKUP_DIR $REMOTE_NAME:$REMOTE_DIR --progress

if [ $? -eq 0 ]; then
    echo "[$(date)] Offsite sync successful."
else
    echo "[$(date)] ERROR: Offsite sync failed!"
    exit 1
fi

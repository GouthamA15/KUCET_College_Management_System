#!/usr/bin/env bash
set -eo pipefail

ACTION=${1:-backup}
BACKUP_FILE=${2:-""}

echo "========================================="
echo "KUCET CMS — Disaster Recovery Tool"
echo "Action: ${ACTION}"
echo "========================================="

if [ "$ACTION" == "backup" ]; then
  echo "Executing manual backup procedure..."
  node -r dotenv/config src/db/backup.js
elif [ "$ACTION" == "restore" ]; then
  if [ -z "$BACKUP_FILE" ]; then
    echo "❌ Error: Please specify backup file path for restoration."
    echo "Usage: ./scripts/deployment/backup-restore.sh restore /path/to/backup.sql"
    exit 1
  fi
  echo "Restoring database snapshot from ${BACKUP_FILE}..."
  mysql -h "${DB_HOST:-localhost}" -u "${DB_USER:-root}" -p"${DB_PASSWORD}" "${DB_DATABASE:-kucet_cms}" < "${BACKUP_FILE}"
  echo "✅ Restoration completed."
else
  echo "Invalid action. Use 'backup' or 'restore'."
  exit 1
fi

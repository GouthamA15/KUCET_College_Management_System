#!/usr/bin/env bash
# =============================================================================
# KUCET CMS — Disaster Recovery & Backup CLI Tool
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

ACTION=${1:-backup}
BACKUP_FILE=${2:-""}

echo "========================================="
echo "KUCET CMS — Disaster Recovery Tool"
echo "Action: ${ACTION}"
echo "========================================="

if [ "$ACTION" == "backup" ]; then
  echo "Executing manual backup procedure..."
  cd "$ROOT_DIR"
  npx tsx src/db/backup.js
elif [ "$ACTION" == "restore" ]; then
  if [ -z "$BACKUP_FILE" ]; then
    echo "❌ Error: Please specify backup file name or path for restoration."
    echo "Usage: ./scripts/deployment/backup-restore.sh restore <filename.sql.gz>"
    exit 1
  fi
  echo "Restoring database snapshot from ${BACKUP_FILE}..."
  cd "$ROOT_DIR"
  npx tsx -e "
    import { DatabaseBackupService } from './src/services/backup/DatabaseBackupService.js';
    async function run() {
      const res = await DatabaseBackupService.restoreBackup({
        filename: '$BACKUP_FILE',
        adminEmail: 'CLI_ADMIN',
        confirmPhrase: 'RESTORE'
      });
      console.log('Restoration completed:', res);
    }
    run().catch(e => { console.error('Restore failed:', e); process.exit(1); });
  "
  echo "✅ Restoration completed."
else
  echo "Invalid action. Use 'backup' or 'restore'."
  exit 1
fi

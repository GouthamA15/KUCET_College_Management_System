import logger from '@/lib/logger';
import { getAuthUser, apiError, apiResponse } from '@/lib/api-utils';
import { DatabaseBackupService } from '@/services/backup/DatabaseBackupService.js';
import { BACKUP_CONSTANTS } from '@/services/backup/backup.constants.js';

export async function POST(req) {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized', 401);

    const body = await req.json().catch(() => ({}));
    const { filename, confirmPhrase } = body;

    if (!filename) {
      return apiError('Filename is required.', 400);
    }

    if (!confirmPhrase || (confirmPhrase !== BACKUP_CONSTANTS.RESTORE_CONFIRM_PHRASE && confirmPhrase !== 'RESTORE_DATABASE')) {
      return apiError(`Confirmation phrase must be exactly "${BACKUP_CONSTANTS.RESTORE_CONFIRM_PHRASE}".`, 400);
    }

    logger.warn(`[CRITICAL_ACTION] Super Admin ${user.email} initiated DATABASE RESTORE using ${filename}`);

    const result = await DatabaseBackupService.restoreBackup({
      filename,
      adminEmail: user.email,
      confirmPhrase,
    });

    return apiResponse(result);
  } catch (error) {
    logger.error({ err: error.message }, 'Error during database restore');
    const status = error.message.includes('already in progress') ? 409 : 500;
    return apiError(error.message || 'Database restoration failed.', status);
  }
}

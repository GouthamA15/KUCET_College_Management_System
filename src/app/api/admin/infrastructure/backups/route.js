import logger from '@/lib/logger';
import { getAuthUser, apiError, apiResponse } from '@/lib/api-utils';
import { DatabaseBackupService } from '@/services/backup/DatabaseBackupService.js';
import { BACKUP_CONSTANTS } from '@/services/backup/backup.constants.js';

export async function GET(_req) {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized', 401);

    const backups = await DatabaseBackupService.listBackups();
    return apiResponse({ backups });
  } catch (error) {
    logger.error({ err: error.message }, 'Error listing backups');
    return apiError('Failed to retrieve backup registry.', 500, error.message);
  }
}

export async function POST(_req) {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized', 401);

    logger.info(`[ADMIN] ${user.email} triggered manual database backup.`);

    const result = await DatabaseBackupService.createBackup({
      triggeredBy: user.email,
      type: BACKUP_CONSTANTS.BACKUP_TYPES.MANUAL,
    });

    return apiResponse({
      success: true,
      message: `Database backup created successfully: ${result.filename}`,
      backup: result,
    });
  } catch (error) {
    logger.error({ err: error.message }, 'Error creating manual backup');
    const status = error.message.includes('already in progress') ? 409 : 500;
    return apiError(error.message || 'Backup creation failed.', status);
  }
}

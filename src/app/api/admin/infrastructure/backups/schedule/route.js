import { getAuthUser, apiError, apiResponse } from '@/lib/api-utils';
import BackupService from '@/services/archive/BackupService';

export async function POST(req) {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized', 401);

    const body = await req.json().catch(() => ({}));
    const summary = await BackupService.runAutomatedBackup(body);
    return apiResponse(summary);
  } catch (error) {
    return apiError(error.message || 'Backup execution failed', 500);
  }
}

export async function GET(_req) {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized', 401);

    const pruneReport = await BackupService.pruneExpiredBackups(30);
    return apiResponse({ schedule: '0 2 * * *', retentionDays: 30, pruneReport });
  } catch (error) {
    return apiError(error.message || 'Failed to fetch backup schedule', 500);
  }
}

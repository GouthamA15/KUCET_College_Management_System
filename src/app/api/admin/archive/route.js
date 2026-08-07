import { getAuthUser, apiResponse, apiError } from '@/lib/api-utils';
import { ArchiveService } from '@/services/archive/ArchiveService';
import logger from '@/lib/logger';

export async function GET() {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized: Admin access required', 401);

    const overview = await ArchiveService.getArchiveOverview();
    return apiResponse(overview);
  } catch (error) {
    logger.error({ err: error.message }, '[API_ADMIN_ARCHIVE_OVERVIEW_ERROR]');
    return apiError(error.message || 'Failed to fetch archive overview', 500);
  }
}

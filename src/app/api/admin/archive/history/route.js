import { getAuthUser, apiResponse, apiError } from '@/lib/api-utils';
import { ArchiveService } from '@/services/archive/ArchiveService';
import logger from '@/lib/logger';

export async function GET(req) {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized: Admin access required', 401);

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const archive_type = searchParams.get('type') || null;

    const history = await ArchiveService.getArchiveHistory({ limit, offset, archive_type });
    return apiResponse({ logs: history, limit, offset });
  } catch (error) {
    logger.error({ err: error.message }, '[API_ADMIN_ARCHIVE_HISTORY_ERROR]');
    return apiError(error.message || 'Failed to fetch archive audit logs', 500);
  }
}

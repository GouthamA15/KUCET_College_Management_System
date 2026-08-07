import { getAuthUser, apiResponse, apiError } from '@/lib/api-utils';
import { ArchiveService } from '@/services/archive/ArchiveService';
import logger from '@/lib/logger';

export async function GET(req) {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized: Admin access required', 401);

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const entity_type = searchParams.get('entity') || 'ALL';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const results = await ArchiveService.searchArchivedRecords({
      search_query: q,
      entity_type,
      limit,
    });

    return apiResponse(results);
  } catch (error) {
    logger.error({ err: error.message }, '[API_ADMIN_ARCHIVE_SEARCH_ERROR]');
    return apiError(error.message || 'Archive search failed', 500);
  }
}

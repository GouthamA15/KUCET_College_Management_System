import { getAuthUser, apiError, apiResponse } from '@/lib/api-utils';
import { OrphanMediaService } from '@/services/archive/OrphanMediaService';
import logger from '@/lib/logger';

export async function GET(_req) {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized', 401);

    const auditReport = await OrphanMediaService.scanOrphanMedia({ dryRun: true });
    return apiResponse({
      timestamp: new Date().toISOString(),
      status: 'HEALTHY',
      report: auditReport,
    });
  } catch (error) {
    logger.error(error, 'Error running storage audit');
    return apiError(error.message || 'Storage audit failed', 500);
  }
}

export async function POST(req) {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized', 401);

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun !== false; // Default true unless explicitly false

    const result = await OrphanMediaService.scanOrphanMedia({ dryRun });
    return apiResponse({
      timestamp: new Date().toISOString(),
      action: dryRun ? 'DRY_RUN' : 'CLEANUP_EXECUTED',
      result,
    });
  } catch (error) {
    logger.error(error, 'Error executing orphan media cleanup');
    return apiError(error.message || 'Cleanup execution failed', 500);
  }
}

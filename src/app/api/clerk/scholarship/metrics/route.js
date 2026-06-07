import { wrapHandler } from '@/lib/api-utils';
import { ScholarshipService } from '@/services/ScholarshipService';

/**
 * GET /api/clerk/scholarship/metrics
 * Fetch aggregate scholarship metrics and window status
 */
export const GET = wrapHandler({
  auth: 'clerk',
  handler: async () => {
    return await ScholarshipService.getMetrics();
  }
});

import logger from '@/lib/logger';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { StudentInactivityService } from '@/services/academic/StudentInactivityService';

let isJobRunning = false;

export async function POST(request) {
  try {
    const user = await getAuthUser('admin');
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || process.env.INTERNAL_API_SECRET;

    const isAuthorizedAdmin = user && user.role === 'admin';
    const isAuthorizedCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!isAuthorizedAdmin && !isAuthorizedCron) {
      return apiError('Unauthorized', 401);
    }

    if (isJobRunning) {
      return apiError('An inactivity scan job is currently in progress. Please wait.', 429);
    }

    isJobRunning = true;
    try {
      let dryRun = false;
      try {
        const body = await request.json();
        dryRun = Boolean(body?.dryRun);
      } catch (_e) {
        dryRun = false;
      }

      const results = await StudentInactivityService.scanAndProcessInactivity({ dryRun });
      return apiResponse({
        success: true,
        dryRun,
        timestamp: new Date().toISOString(),
        results
      });
    } finally {
      isJobRunning = false;
    }
  } catch (err) {
    logger.error('Error running student inactivity scan:', err);
    return apiError('Internal Server Error', 500);
  }
}

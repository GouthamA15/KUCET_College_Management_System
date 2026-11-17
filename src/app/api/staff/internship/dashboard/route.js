import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { InternshipReportingService } from '@/services/internships/InternshipReportingService';
import { CoordinatorAssignmentService } from '@/services/identity/CoordinatorAssignmentService';
import logger from '@/lib/logger';

export async function GET(_req) {
  try {
    const user = await getAuthUser('internship_coordinator');
    if (!user) {
      return apiError('Forbidden: Only the designated Internship Coordinator or Administrator can access this console', 403);
    }

    const metrics = await InternshipReportingService.getDashboardMetrics();
    const activeCoordinator = await CoordinatorAssignmentService.getActiveInternshipCoordinator();

    return apiResponse({
      success: true,
      data: {
        metrics,
        coordinator: activeCoordinator,
      },
    });
  } catch (err) {
    logger.error({ err: err.message }, '[GET_COORDINATOR_DASHBOARD_ERROR]');
    return apiError(err.message, 500);
  }
}

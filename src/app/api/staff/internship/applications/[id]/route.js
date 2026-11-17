import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { StudentInternshipService } from '@/services/internships/StudentInternshipService';
import logger from '@/lib/logger';

export async function GET(req, { params }) {
  try {
    const user = await getAuthUser('internship_coordinator');
    if (!user) {
      return apiError('Forbidden: Access restricted to the designated Internship Coordinator or Administrator', 403);
    }

    const { id } = await params;
    const internship = await StudentInternshipService.getInternshipById(id, {
      isCoordinator: true,
    });

    if (!internship) {
      return apiError('Internship record not found', 404);
    }

    return apiResponse({
      success: true,
      data: internship,
    });
  } catch (err) {
    logger.error({ err: err.message }, '[GET_COORDINATOR_APPLICATION_DETAIL_ERROR]');
    return apiError(err.message, 500);
  }
}

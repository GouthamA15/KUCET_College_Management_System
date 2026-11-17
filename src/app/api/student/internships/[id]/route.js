import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { StudentInternshipService } from '@/services/internships/StudentInternshipService';
import logger from '@/lib/logger';

export async function GET(req, { params }) {
  try {
    const user = await getAuthUser('student');
    if (!user) return apiError('Unauthorized', 401);

    const { id } = await params;
    const studentId = user.id || user.student_id;

    const internship = await StudentInternshipService.getInternshipById(id, {
      studentId,
      isCoordinator: false,
    });

    if (!internship) {
      return apiError('Internship record not found', 404);
    }

    return apiResponse({
      success: true,
      data: internship,
    });
  } catch (err) {
    const status = err.status || 500;
    logger.error({ err: err.message }, '[GET_STUDENT_INTERNSHIP_DETAIL_ERROR]');
    return apiError(err.message, status);
  }
}

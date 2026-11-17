import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { StudentInternshipService } from '@/services/internships/StudentInternshipService';
import logger from '@/lib/logger';

export async function GET(req) {
  try {
    const student = await getAuthUser('student');
    if (!student) return apiError('Unauthorized', 401);

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const excludeId = searchParams.get('exclude_id');

    if (!startDate || !endDate) {
      return apiError('start_date and end_date are required', 400);
    }

    const studentId = student.id || student.student_id;
    const result = await StudentInternshipService.checkInternshipDateOverlaps({
      studentId,
      startDate,
      endDate,
      excludeInternshipId: excludeId,
    });

    return apiResponse({
      success: true,
      data: result,
    });
  } catch (err) {
    logger.error({ err: err.message }, '[CHECK_INTERNSHIP_OVERLAP_ERROR]');
    return apiError(err.message, err.status || 500);
  }
}

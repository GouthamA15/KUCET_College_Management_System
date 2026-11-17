import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { StudentInternshipService } from '@/services/internships/StudentInternshipService';
import logger from '@/lib/logger';

export async function GET(_req) {
  try {
    const student = await getAuthUser('student');
    if (!student) return apiError('Unauthorized', 401);

    const studentId = student.id || student.student_id;
    const internships = await StudentInternshipService.getStudentInternships(studentId);

    const stats = {
      total: internships.length,
      approved: internships.filter(i => i.application_status === 'APPROVED').length,
      pending: internships.filter(i => ['SUBMITTED', 'UNDER_REVIEW'].includes(i.application_status)).length,
      completed: internships.filter(i => i.completion_status === 'VERIFIED_COMPLETED').length,
      action_required: internships.filter(i => 
        i.application_status === 'ADDITIONAL_INFO_REQUIRED' || 
        i.completion_status === 'ADDITIONAL_DOCS_REQUESTED'
      ).length,
    };

    return apiResponse({
      success: true,
      data: {
        stats,
        internships,
      },
    });
  } catch (err) {
    logger.error({ err: err.message }, '[GET_STUDENT_INTERNSHIPS_ERROR]');
    return apiError(err.message, 500);
  }
}

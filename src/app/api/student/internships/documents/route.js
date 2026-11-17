import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { InternshipDocumentService } from '@/services/internships/InternshipDocumentService';
import logger from '@/lib/logger';

export async function GET(_req) {
  try {
    const student = await getAuthUser('student');
    if (!student) return apiError('Unauthorized', 401);

    const studentId = student.id || student.student_id;
    const docs = await InternshipDocumentService.getStudentDocuments(studentId);

    return apiResponse({
      success: true,
      data: docs,
    });
  } catch (err) {
    logger.error({ err: err.message }, '[GET_STUDENT_INTERNSHIP_DOCUMENTS_ERROR]');
    return apiError(err.message, err.status || 500);
  }
}

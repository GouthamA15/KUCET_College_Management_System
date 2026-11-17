import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { InternshipDocumentService } from '@/services/internships/InternshipDocumentService';
import logger from '@/lib/logger';

export async function DELETE(req, { params }) {
  try {
    const user = await getAuthUser('student');
    if (!user) return apiError('Unauthorized', 401);

    const { docId } = await params;
    const studentId = user.id || user.student_id;
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Student Workspace';

    const result = await InternshipDocumentService.deleteDocument(docId, {
      studentId,
      isCoordinator: false,
      ip,
      userAgent,
    });

    return apiResponse(result);
  } catch (err) {
    const status = err.status || 500;
    logger.error({ err: err.message }, '[STUDENT_DELETE_DOCUMENT_ERROR]');
    return apiError(err.message, status);
  }
}

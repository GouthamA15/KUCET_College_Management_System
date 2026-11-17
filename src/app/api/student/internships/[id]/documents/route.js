import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { InternshipDocumentService, ALLOWED_DOC_TYPES } from '@/services/internships/InternshipDocumentService';
import logger from '@/lib/logger';
import { z } from 'zod';

const UploadDocumentSchema = z.object({
  document_type: z.enum(ALLOWED_DOC_TYPES, { message: 'Invalid document type' }),
  file: z.string().min(1, 'File content is required'),
  filename: z.string().default('document.pdf'),
});

export async function POST(req, { params }) {
  try {
    const user = await getAuthUser('student');
    if (!user) return apiError('Unauthorized', 401);

    const { id: internshipId } = await params;
    const studentId = user.id || user.student_id;

    let body;
    try {
      body = await req.json();
    } catch (_e) {
      return apiError('Invalid JSON payload', 400);
    }

    const parsed = UploadDocumentSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('Validation Error', 400, parsed.error.format());
    }

    const { document_type, file, filename } = parsed.data;
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Student Workspace';

    const result = await InternshipDocumentService.uploadDocument({
      internshipId,
      studentId,
      documentType: document_type,
      file,
      originalFilename: filename,
      uploadedByUserType: 'STUDENT',
      uploadedById: studentId,
      ip,
      userAgent,
    });

    return apiResponse({
      success: true,
      message: 'Document uploaded successfully',
      data: result,
    }, 201);
  } catch (err) {
    const status = err.status || 500;
    logger.error({ err: err.message }, '[STUDENT_UPLOAD_DOCUMENT_ERROR]');
    return apiError(err.message, status);
  }
}

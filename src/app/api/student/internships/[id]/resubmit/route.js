import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { StudentInternshipService } from '@/services/internships/StudentInternshipService';
import logger from '@/lib/logger';
import { z } from 'zod';

const ResubmitInfoSchema = z.object({
  remarks: z.string().max(2000).optional().nullable(),
  new_documents: z.array(z.object({
    document_type: z.string(),
    file: z.string(),
    filename: z.string().default('document.pdf'),
  })).optional().default([]),
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

    const parsed = ResubmitInfoSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('Validation Error', 400, parsed.error.format());
    }

    const { remarks, new_documents } = parsed.data;
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Student Workspace';

    const result = await StudentInternshipService.resubmitAdditionalInfo(internshipId, {
      studentId,
      remarks,
      newDocuments: new_documents.map(d => ({
        documentType: d.document_type,
        file: d.file,
        filename: d.filename,
      })),
      ip,
      userAgent,
    });

    return apiResponse(result);
  } catch (err) {
    const status = err.status || 500;
    logger.error({ err: err.message }, '[RESUBMIT_INFO_ERROR]');
    return apiError(err.message, status);
  }
}

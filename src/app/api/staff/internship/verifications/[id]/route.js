import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { StudentInternshipService } from '@/services/internships/StudentInternshipService';
import logger from '@/lib/logger';
import { z } from 'zod';

const VerifyCompletionSchema = z.object({
  action: z.enum(['VERIFY', 'REJECT', 'REQUEST_DOCS', 'REQUEST_CORRECTION'], { message: 'Action must be VERIFY, REJECT, REQUEST_DOCS, or REQUEST_CORRECTION' }),
  remarks: z.string().max(2000).optional().nullable(),
});

export async function POST(req, { params }) {
  try {
    const user = await getAuthUser('internship_coordinator');
    if (!user) {
      return apiError('Forbidden: Access restricted to the designated Internship Coordinator or Administrator', 403);
    }

    const { id: internshipId } = await params;

    let body;
    try {
      body = await req.json();
    } catch (_e) {
      return apiError('Invalid JSON payload', 400);
    }

    const parsed = VerifyCompletionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('Validation Error', 400, parsed.error.format());
    }

    const { action, remarks } = parsed.data;
    const staffId = user.id || user.staffId;
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Coordinator Workspace';

    const result = await StudentInternshipService.verifyCompletion(internshipId, {
      action,
      remarks,
      staffId,
      ip,
      userAgent,
    });

    return apiResponse({
      success: true,
      message: `Internship completion status updated: ${action}`,
      data: result,
    });
  } catch (err) {
    const status = err.status || 500;
    logger.error({ err: err.message }, '[VERIFY_COMPLETION_ERROR]');
    return apiError(err.message, status);
  }
}

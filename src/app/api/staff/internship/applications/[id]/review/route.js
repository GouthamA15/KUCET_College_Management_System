import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { StudentInternshipService } from '@/services/internships/StudentInternshipService';
import logger from '@/lib/logger';
import { z } from 'zod';

const ReviewApplicationSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'REQUEST_INFO'], { message: 'Action must be APPROVE, REJECT, or REQUEST_INFO' }),
  remarks: z.string().max(2000).optional().nullable(),
  instructions: z.string().max(2000).optional().nullable(),
  is_unverified_company_exception: z.boolean().optional().default(false),
  exception_reason: z.string().max(2000).optional().nullable(),
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

    const parsed = ReviewApplicationSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('Validation Error', 400, parsed.error.format());
    }

    const { action, remarks, instructions, is_unverified_company_exception, exception_reason } = parsed.data;
    const staffId = user.id || user.staffId;
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Coordinator Workspace';

    const result = await StudentInternshipService.reviewApplication(internshipId, {
      action,
      remarks,
      instructions,
      isUnverifiedCompanyException: is_unverified_company_exception,
      exceptionReason: exception_reason,
      staffId,
      ip,
      userAgent,
    });

    return apiResponse({
      success: true,
      message: `Internship application successfully processed: ${action}`,
      data: result,
    });
  } catch (err) {
    const status = err.status || 500;
    logger.error({ err: err.message }, '[REVIEW_APPLICATION_ERROR]');
    return apiError(err.message, status);
  }
}

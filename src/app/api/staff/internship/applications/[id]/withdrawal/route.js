import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { StudentInternshipService } from '@/services/internships/StudentInternshipService';
import logger from '@/lib/logger';
import { z } from 'zod';

const WithdrawalReviewSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT'], { message: 'Action must be APPROVE or REJECT' }),
  remarks: z.string().optional().nullable(),
});

export async function POST(req, { params }) {
  try {
    const user = await getAuthUser('internship_coordinator');
    if (!user) {
      return apiError('Forbidden: Only the designated Internship Coordinator or Administrator can review withdrawals', 403);
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = WithdrawalReviewSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message || 'Invalid input', 400);
    }

    const staffId = user.id || user.staffId;
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Coordinator Workspace';

    const updated = await StudentInternshipService.handleWithdrawalReview(id, {
      action: parsed.data.action,
      remarks: parsed.data.remarks,
      staffId,
      ip,
      userAgent,
    });

    return apiResponse({
      success: true,
      data: updated,
      message: `Withdrawal request ${parsed.data.action.toLowerCase()}d successfully`,
    });
  } catch (err) {
    logger.error({ err: err.message }, '[COORDINATOR_WITHDRAWAL_REVIEW_ERROR]');
    return apiError(err.message, err.status || 500);
  }
}

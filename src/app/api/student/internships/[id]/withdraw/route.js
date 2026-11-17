import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { StudentInternshipService } from '@/services/internships/StudentInternshipService';
import logger from '@/lib/logger';
import { z } from 'zod';

const WithdrawSchema = z.object({
  reason: z.string().min(5, 'Withdrawal reason must be at least 5 characters'),
});

export async function POST(req, { params }) {
  try {
    const student = await getAuthUser('student');
    if (!student) return apiError('Unauthorized', 401);

    const { id } = await params;
    const body = await req.json();
    const parsed = WithdrawSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message || 'Invalid input', 400);
    }

    const studentId = student.id || student.student_id;
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Student App';

    const result = await StudentInternshipService.requestWithdrawal(id, {
      studentId,
      reason: parsed.data.reason,
      ip,
      userAgent,
    });

    return apiResponse(result);
  } catch (err) {
    logger.error({ err: err.message }, '[STUDENT_WITHDRAWAL_REQUEST_ERROR]');
    return apiError(err.message, err.status || 500);
  }
}

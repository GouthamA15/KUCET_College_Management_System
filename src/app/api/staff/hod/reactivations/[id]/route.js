import logger from '@/lib/logger';
import { db } from '@/db';
import { studentReactivationRequests, students } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser, logAudit } from '@/lib/api-utils';
import { getBranchFromRoll } from '@/lib/rollNumber';
import { z } from 'zod';

const hodDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  remarks: z.string().trim().max(500).optional().nullable()
});

export async function PUT(request, { params }) {
  try {
    const user = await getAuthUser('hod');
    if (!user || (!((user.role === 'faculty' && user.is_hod) || user.role === 'admin'))) {
      return apiError('Unauthorized', 401);
    }

    const resolvedParams = await params;
    const requestId = parseInt(resolvedParams.id, 10);
    if (!requestId || isNaN(requestId)) {
      return apiError('Invalid request ID', 400);
    }

    const body = await request.json();
    const validated = hodDecisionSchema.parse(body);
    const { decision, remarks } = validated;

    if (decision === 'REJECTED' && (!remarks || remarks.trim().length === 0)) {
      return apiError('Remarks are required when rejecting a reactivation request', 400);
    }

    // 1. Fetch reactivation request
    const [reqRow] = await db.select({
      id: studentReactivationRequests.id,
      student_id: studentReactivationRequests.student_id,
      status: studentReactivationRequests.status,
      roll_no: students.roll_no
    })
    .from(studentReactivationRequests)
    .innerJoin(students, eq(studentReactivationRequests.student_id, students.id))
    .where(eq(studentReactivationRequests.id, requestId))
    .limit(1);

    if (!reqRow) {
      return apiError('Reactivation request not found', 404);
    }

    if (reqRow.status !== 'PENDING_HOD') {
      return apiError(`Request has already been processed at the HOD stage (current status: ${reqRow.status}).`, 409);
    }

    // Branch check for HOD / Principal
    const studentBranch = getBranchFromRoll(reqRow.roll_no);
    const authorizedBranches = user.authorized_branches || (user.branch ? [user.branch] : []);
    if (user.role !== 'admin' && authorizedBranches.length > 0 && !authorizedBranches.includes(studentBranch)) {
      return apiError(`Forbidden. You can only review requests for ${authorizedBranches.join(', ')} department.`, 403);
    }

    const now = new Date();
    const nextStatus = decision === 'APPROVED' ? 'PENDING_ADMIN' : 'REJECTED';

    await db.update(studentReactivationRequests)
      .set({
        status: nextStatus,
        hod_reviewer_id: user.id,
        hod_reviewed_at: now,
        hod_decision: decision,
        hod_remarks: remarks ? remarks.trim() : null,
        updated_at: now
      })
      .where(eq(studentReactivationRequests.id, requestId));

    await logAudit(request, {
      userId: user.id,
      userType: 'STAFF',
      action: decision === 'APPROVED' ? 'HOD_APPROVE_REACTIVATION' : 'HOD_REJECT_REACTIVATION',
      targetId: requestId,
      targetType: 'reactivation_request',
      before: { status: reqRow.status },
      after: { status: nextStatus, hod_decision: decision, hod_remarks: remarks }
    });

    return apiResponse({
      success: true,
      status: nextStatus,
      message: decision === 'APPROVED'
        ? 'Reactivation endorsed by HOD and forwarded to Super Admin for final approval.'
        : 'Reactivation request rejected by HOD.'
    });
  } catch (err) {
    if (err?.name === 'ZodError') {
      return apiError(err.errors[0]?.message || 'Validation error', 400);
    }
    logger.error('Error reviewing HOD reactivation:', err);
    return apiError('Internal Server Error', 500);
  }
}

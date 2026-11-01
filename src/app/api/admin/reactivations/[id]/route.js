import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  studentReactivationRequests, 
  students, 
  studentInactivityLogs 
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser, logAudit } from '@/lib/api-utils';
import { getCollegeAcademicYear } from '@/lib/academic-utils';
import { z } from 'zod';

const adminDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  remarks: z.string().trim().max(500).optional().nullable()
});

export async function PUT(request, { params }) {
  try {
    const user = await getAuthUser('admin');
    if (!user || user.role !== 'admin') {
      return apiError('Unauthorized', 401);
    }

    const resolvedParams = await params;
    const requestId = parseInt(resolvedParams.id, 10);
    if (!requestId || isNaN(requestId)) {
      return apiError('Invalid request ID', 400);
    }

    const body = await request.json();
    const validated = adminDecisionSchema.parse(body);
    const { decision, remarks } = validated;

    if (decision === 'REJECTED' && (!remarks || remarks.trim().length === 0)) {
      return apiError('Remarks are required when rejecting a reactivation request', 400);
    }

    const [reqRow] = await db.select()
      .from(studentReactivationRequests)
      .where(eq(studentReactivationRequests.id, requestId))
      .limit(1);

    if (!reqRow) {
      return apiError('Reactivation request not found', 404);
    }

    if (reqRow.status !== 'PENDING_ADMIN') {
      return apiError(`Cannot process request with status: ${reqRow.status}. HOD recommendation must be completed first.`, 409);
    }

    const now = new Date();
    const academicYear = await getCollegeAcademicYear();

    await db.transaction(async (tx) => {
      // 1. Update reactivation request
      await tx.update(studentReactivationRequests)
        .set({
          status: decision,
          admin_reviewer_id: user.id,
          admin_reviewed_at: now,
          admin_decision: decision,
          admin_remarks: remarks ? remarks.trim() : null,
          updated_at: now
        })
        .where(eq(studentReactivationRequests.id, requestId));

      if (decision === 'APPROVED') {
        // 2. Reactivate the student account
        await tx.update(students)
          .set({
            student_status: 'ACTIVE',
            updated_at: now
          })
          .where(eq(students.id, reqRow.student_id));

        // 3. Insert reactivation audit log
        await tx.insert(studentInactivityLogs).values({
          student_id: reqRow.student_id,
          academic_year: academicYear || '2025-26',
          last_attendance_date: now,
          inactivity_days: 0,
          action_taken: 'REACTIVATED',
          authorized_by_id: user.id,
          remarks: remarks ? `Dual-approved reactivation: ${remarks.trim()}` : 'Dual-approved reactivation completed by Admin.'
        });
      }
    });

    await logAudit(request, {
      userId: user.id,
      userType: 'ADMIN',
      action: decision === 'APPROVED' ? 'ADMIN_APPROVE_REACTIVATION' : 'ADMIN_REJECT_REACTIVATION',
      targetId: requestId,
      targetType: 'reactivation_request',
      before: { status: reqRow.status },
      after: { status: decision, admin_decision: decision, admin_remarks: remarks }
    });

    return apiResponse({
      success: true,
      status: decision,
      message: decision === 'APPROVED'
        ? 'Student account reactivated successfully.'
        : 'Reactivation request rejected.'
    });
  } catch (err) {
    if (err?.name === 'ZodError') {
      return apiError(err.errors[0]?.message || 'Validation error', 400);
    }
    logger.error('Error reviewing Admin reactivation:', err);
    return apiError('Internal Server Error', 500);
  }
}

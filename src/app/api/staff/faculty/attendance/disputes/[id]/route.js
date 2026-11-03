import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  studentAttendanceDisputes, 
  studentAttendance, 
  attendanceAuditLogs,
  facultySubjectAssignments 
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser, logAudit } from '@/lib/api-utils';
import { z } from 'zod';

const reviewDisputeSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'MORE_INFO_REQUIRED']),
  rejection_reason: z.string().trim().max(500).optional().nullable(),
  reviewer_comments: z.string().trim().max(1000).optional().nullable()
});

export async function PUT(request, { params }) {
  try {
    const user = await getAuthUser('faculty');
    if (!user || (user.role !== 'faculty' && user.role !== 'admin')) {
      return apiError('Unauthorized', 401);
    }

    const resolvedParams = await params;
    const disputeId = parseInt(resolvedParams.id, 10);
    if (!disputeId || isNaN(disputeId)) {
      return apiError('Invalid dispute ID', 400);
    }

    const body = await request.json();
    const validated = reviewDisputeSchema.parse(body);
    const { status, rejection_reason, reviewer_comments } = validated;

    if (status === 'REJECTED' && (!rejection_reason || rejection_reason.trim().length === 0)) {
      return apiError('Rejection reason is required when rejecting a dispute', 400);
    }

    if (status === 'MORE_INFO_REQUIRED' && (!reviewer_comments || reviewer_comments.trim().length < 5)) {
      return apiError('Reviewer comments (minimum 5 characters) are required when requesting more information', 400);
    }

    // 1. Fetch dispute and check authorization
    const [dispute] = await db.select({
      id: studentAttendanceDisputes.id,
      student_id: studentAttendanceDisputes.student_id,
      assignment_id: studentAttendanceDisputes.assignment_id,
      attendance_date: studentAttendanceDisputes.attendance_date,
      session: studentAttendanceDisputes.session,
      original_status: studentAttendanceDisputes.original_status,
      requested_status: studentAttendanceDisputes.requested_status,
      reason: studentAttendanceDisputes.reason,
      reviewer_comments: studentAttendanceDisputes.reviewer_comments,
      status: studentAttendanceDisputes.status,
      faculty_id: facultySubjectAssignments.staff_account_id,
      subject_code: facultySubjectAssignments.subject_code,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      academic_year: facultySubjectAssignments.academic_year
    })
    .from(studentAttendanceDisputes)
    .innerJoin(facultySubjectAssignments, eq(studentAttendanceDisputes.assignment_id, facultySubjectAssignments.id))
    .where(eq(studentAttendanceDisputes.id, disputeId))
    .limit(1);

    if (!dispute) {
      return apiError('Dispute not found', 404);
    }

    if (dispute.status === 'APPROVED' || dispute.status === 'REJECTED') {
      return apiError('This dispute has already been resolved', 409);
    }

    let isAuthorized = false;
    if (user.role === 'admin') {
      isAuthorized = true;
    } else if (Number(dispute.faculty_id) === Number(user.id) || Number(dispute.faculty_id) === Number(user.staffId)) {
      isAuthorized = true;
    } else if (user.is_principal || user.is_hod) {
      const authorizedBranches = user.authorized_branches || (user.branch ? [user.branch] : []);
      if (authorizedBranches.length > 0 && (authorizedBranches.includes(dispute.branch) || user.branch === dispute.branch)) {
        isAuthorized = true;
      }
    }

    // Co-instructor and substitute authorization guards
    if (!isAuthorized) {
      const { timetableSlotFaculty, branchTimetable, facultySubstitutions } = await import('@/db/schema');
      const coInstructor = await db.select({ id: timetableSlotFaculty.id })
        .from(timetableSlotFaculty)
        .innerJoin(branchTimetable, eq(timetableSlotFaculty.slot_id, branchTimetable.id))
        .where(and(
          eq(timetableSlotFaculty.faculty_id, user.id),
          eq(branchTimetable.branch, dispute.branch),
          eq(branchTimetable.semester, dispute.course_semester),
          eq(branchTimetable.subject_code, dispute.subject_code),
          eq(branchTimetable.academic_year, dispute.academic_year)
        ))
        .limit(1);

      if (coInstructor.length > 0) {
        isAuthorized = true;
      }

      if (!isAuthorized) {
        const substitution = await db.select({ id: facultySubstitutions.id })
          .from(facultySubstitutions)
          .where(and(
            eq(facultySubstitutions.original_assignment_id, dispute.assignment_id),
            eq(facultySubstitutions.substitute_faculty_id, user.id),
            eq(facultySubstitutions.substitution_date, dispute.attendance_date)
          ))
          .limit(1);

        if (substitution.length > 0) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return apiError('Unauthorized to review this dispute', 403);
    }

    const now = new Date();

    // 2. Transactional Update & Audit Log
    await db.transaction(async (tx) => {
      // Update dispute record
      await tx.update(studentAttendanceDisputes)
        .set({
          status,
          reviewed_by_staff_id: user.id,
          reviewed_at: now,
          rejection_reason: status === 'REJECTED' ? rejection_reason.trim() : null,
          reviewer_comments: status === 'MORE_INFO_REQUIRED' ? reviewer_comments.trim() : (status === 'APPROVED' ? null : dispute.reviewer_comments)
        })
        .where(eq(studentAttendanceDisputes.id, disputeId));

      if (status === 'APPROVED') {
        // Query the exact attendance record to obtain session_id
        const [attRow] = await tx.select({
          id: studentAttendance.id,
          session_id: studentAttendance.session_id
        })
        .from(studentAttendance)
        .where(and(
          eq(studentAttendance.student_id, dispute.student_id),
          eq(studentAttendance.assignment_id, dispute.assignment_id),
          eq(studentAttendance.date, dispute.attendance_date),
          eq(studentAttendance.session, dispute.session)
        ))
        .limit(1);

        if (attRow) {
          // Exact session_id + student_id predicate pinned by unique constraints
          const updatePredicate = attRow.session_id
            ? and(
                eq(studentAttendance.id, attRow.id),
                eq(studentAttendance.session_id, attRow.session_id),
                eq(studentAttendance.student_id, dispute.student_id)
              )
            : and(
                eq(studentAttendance.id, attRow.id),
                eq(studentAttendance.student_id, dispute.student_id)
              );

          await tx.update(studentAttendance)
            .set({ status: dispute.requested_status })
            .where(updatePredicate);
        }

        // Insert auditable log
        await tx.insert(attendanceAuditLogs).values({
          student_id: dispute.student_id,
          assignment_id: dispute.assignment_id,
          attendance_date: dispute.attendance_date,
          session: dispute.session,
          previous_status: dispute.original_status,
          new_status: dispute.requested_status,
          modified_by_staff_id: user.id,
          change_type: 'DISPUTE_RESOLUTION',
          dispute_id: dispute.id,
          reason: `Dispute approved by staff #${user.id}: ${dispute.reason}`
        });
      }
    });

    const actionMap = {
      APPROVED: 'APPROVE_ATTENDANCE_DISPUTE',
      REJECTED: 'REJECT_ATTENDANCE_DISPUTE',
      MORE_INFO_REQUIRED: 'REQUEST_MORE_INFO_ATTENDANCE_DISPUTE'
    };

    await logAudit(request, {
      userId: user.id,
      userType: 'STAFF',
      action: actionMap[status] || 'REVIEW_ATTENDANCE_DISPUTE',
      targetId: disputeId,
      targetType: 'attendance_dispute',
      before: { status: dispute.status },
      after: { status, rejection_reason, reviewer_comments }
    });

    return apiResponse({
      success: true,
      message: status === 'APPROVED' 
        ? 'Dispute approved and attendance corrected successfully.' 
        : status === 'REJECTED' 
          ? 'Dispute rejected successfully.' 
          : 'Additional information requested from student.'
    });
  } catch (err) {
    if (err?.name === 'ZodError') {
      return apiError(err.errors[0]?.message || 'Validation error', 400);
    }
    logger.error('Error reviewing attendance dispute:', err);
    return apiError('Internal Server Error', 500);
  }
}

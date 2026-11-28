import logger from '@/lib/logger';
import { db } from '@/db';
import { facultySubjectAssignments, students as studentsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser, logAudit } from '@/lib/api-utils';
import { UnifiedAttendanceRepository } from '@/services/attendance/UnifiedAttendanceRepository';
import { StreakService } from '@/services/attendance/StreakService';
import { z } from 'zod';

const historicalCorrectionSchema = z.object({
  student_id: z.preprocess(v => Number(v), z.number().int().positive()),
  assignment_id: z.preprocess(v => Number(v), z.number().int().positive()),
  attendance_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'attendance_date must be YYYY-MM-DD'),
  session: z.preprocess(v => Number(v), z.number().int().min(1).max(8)),
  new_status: z.enum(['PRESENT', 'ABSENT', 'NCC', 'MEDICAL']),
  reason: z.string().trim().min(10, 'Historical correction requires a detailed reason (minimum 10 characters)').max(1000),
});

/**
 * POST /api/staff/faculty/attendance/historical-correction
 *
 * Policy-controlled endpoint allowing Admin, Principal, or Branch HOD to correct
 * active or archived historical attendance records outside the 7-day student dispute window,
 * while preserving immutable audit history and recalculating lifetime student streaks.
 */
export async function POST(request) {
  try {
    const user = await getAuthUser('faculty');
    if (!user || (user.role !== 'admin' && !user.is_principal && !user.is_hod)) {
      return apiError('Forbidden: Historical attendance corrections require Admin, Principal, or HOD authorization', 403);
    }

    const body = await request.json();
    const validated = historicalCorrectionSchema.parse(body);
    const { student_id, assignment_id, attendance_date, session, new_status, reason } = validated;

    const [assignment] = await db
      .select({
        id: facultySubjectAssignments.id,
        branch: facultySubjectAssignments.branch,
        course_semester: facultySubjectAssignments.course_semester,
        academic_year: facultySubjectAssignments.academic_year,
      })
      .from(facultySubjectAssignments)
      .where(eq(facultySubjectAssignments.id, assignment_id))
      .limit(1);

    if (!assignment) {
      return apiError('Subject assignment not found', 404);
    }

    if (user.role !== 'admin' && !user.is_principal) {
      const authorizedBranches = user.authorized_branches || (user.branch ? [user.branch] : []);
      if (!authorizedBranches.includes(assignment.branch) && user.branch !== assignment.branch) {
        return apiError('Forbidden: Outside your authorized branch scope', 403);
      }
    }

    const existingLookup = await UnifiedAttendanceRepository.getAttendanceRecordForDispute({
      studentId: student_id,
      assignmentId: assignment_id,
      attendanceDate: attendance_date,
      session,
    });

    if (!existingLookup) {
      return apiError('Historical attendance record not found in active or archived storage', 404);
    }

    const [studentRow] = await db
      .select({ roll_no: studentsTable.roll_no })
      .from(studentsTable)
      .where(eq(studentsTable.id, student_id))
      .limit(1);

    const rollNo = studentRow?.roll_no || null;

    let preStreak = 0;
    let preLongest = 0;
    try {
      const before = await StreakService.calculateStudentStreak({
        studentId: student_id,
        rollNo,
        includeAllSemesters: true,
      });
      preStreak = before?.currentStreak || 0;
      preLongest = before?.longestStreak || 0;
    } catch (_err) {
      // Non-fatal
    }

    let correctionResult;
    await db.transaction(async (tx) => {
      correctionResult = await UnifiedAttendanceRepository.updateAttendanceStatusWithAudit({
        studentId: student_id,
        assignmentId: assignment_id,
        attendanceDate: attendance_date,
        session,
        newStatus: new_status,
        previousStatus: existingLookup.record.status,
        modifierStaffId: user.id,
        changeType: 'HISTORICAL_CORRECTION',
        disputeId: null,
        reason,
        tx,
      });
    });

    await logAudit(request, {
      userId: user.id,
      userType: user.role === 'admin' ? 'ADMIN' : 'STAFF',
      action: 'HISTORICAL_ATTENDANCE_CORRECTION',
      targetId: `${student_id}:${assignment_id}:${attendance_date}:${session}`,
      targetType: 'student_attendance',
      before: { status: correctionResult.previousStatus, source: existingLookup.source },
      after: { status: new_status, reason },
    });

    let reconciliationResult = null;
    try {
      reconciliationResult = await StreakService.reconcileStudentAfterCorrection({
        studentId: student_id,
        rollNo,
        triggerSource: 'HISTORICAL_CORRECTION',
        previousStreak: preStreak,
        previousLongest: preLongest,
        notes: `Historical correction by staff #${user.id} (${correctionResult.previousStatus} -> ${new_status}): ${reason}`,
      });
    } catch (recErr) {
      logger.warn({ err: recErr }, '[HISTORICAL_CORRECTION_RECONCILE_WARN]');
    }

    return apiResponse({
      success: true,
      source: existingLookup.source,
      previousStatus: correctionResult.previousStatus,
      newStatus: new_status,
      streakRecalculated: Boolean(reconciliationResult?.success),
      streakData: reconciliationResult?.streakData || null,
      message: 'Historical attendance record corrected with audit trail and streak reconciliation.',
    });
  } catch (err) {
    if (err?.name === 'ZodError') {
      return apiError(err.errors?.[0]?.message || 'Validation error', 400);
    }
    logger.error({ err: err.message }, '[HISTORICAL_CORRECTION_ERROR]');
    return apiError('Internal Server Error', 500);
  }
}

import { db } from '@/db';
import { 
  facultySubjectAssignments, 
  attendanceSessions,
  studentAttendance 
} from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import logger from '@/lib/logger';

export class AttendanceCalculationService {
  /**
   * Calculates comprehensive attendance coverage and metrics for a student cohort.
   *
   * Query Architecture:
   * 1. Drives from facultySubjectAssignments for the student's branch, semester, and academic year.
   * 2. LEFT JOINs authoritative attendanceSessions that are active and have submitted_at IS NOT NULL
   *    (ignoring unsubmitted/cancelled sessions).
   * 3. LEFT JOINs studentAttendance matching session_id and student_id.
   * 4. Evaluates attended statuses: 'PRESENT', 'NCC', 'MEDICAL'.
   * 5. Uses COUNT(DISTINCT ...) to prevent any duplicate join rows from inflating counts.
   * 6. Preserves subjects with zero conducted sessions.
   * 7. Enforces conservative zero-session policy: blocks approval (canApprove: false)
   *    and sets attendance to 'N/A' when 0 sessions have been recorded.
   *
   * @param {Object} params
   * @param {number} params.studentId
   * @param {string} params.branch
   * @param {number} params.semester
   * @param {string} params.academicYear
   * @param {Object} [params.dbClient] - Optional active transaction handle
   * @returns {Promise<Object>} Aggregated attendance metrics and coverage status
   */
  static async calculateCohortAttendance({ studentId, branch, semester, academicYear, dbClient }) {
    const executor = dbClient || db;

    try {
      if (!studentId || !semester || !academicYear) {
        return {
          success: false,
          canApprove: false,
          blockReason: 'Missing required parameters for attendance calculation (studentId, semester, academicYear).',
          generatedAttendance: 'N/A'
        };
      }

      const conditions = [
        eq(facultySubjectAssignments.course_semester, Number(semester)),
        eq(facultySubjectAssignments.academic_year, academicYear),
        eq(facultySubjectAssignments.is_active, true)
      ];

      if (branch) {
        conditions.push(eq(facultySubjectAssignments.branch, branch));
      }

      const subjectRows = await executor.select({
        assignmentId: facultySubjectAssignments.id,
        subjectCode: facultySubjectAssignments.subject_code,
        subjectName: facultySubjectAssignments.subject_name,
        totalSessions: sql`COUNT(DISTINCT ${attendanceSessions.id})`,
        attendedSessions: sql`COUNT(DISTINCT CASE WHEN ${studentAttendance.status} IN ('PRESENT', 'NCC', 'MEDICAL') THEN ${attendanceSessions.id} END)`
      })
      .from(facultySubjectAssignments)
      .leftJoin(attendanceSessions, and(
        eq(attendanceSessions.assignment_id, facultySubjectAssignments.id),
        eq(attendanceSessions.is_active, true),
        sql`${attendanceSessions.submitted_at} IS NOT NULL`
      ))
      .leftJoin(studentAttendance, and(
        eq(studentAttendance.session_id, attendanceSessions.id),
        eq(studentAttendance.student_id, studentId)
      ))
      .where(and(...conditions))
      .groupBy(
        facultySubjectAssignments.id,
        facultySubjectAssignments.subject_code,
        facultySubjectAssignments.subject_name
      );

      const totalAssignedSubjects = subjectRows.length;
      const subjectsWithSessions = subjectRows.filter(r => Number(r.totalSessions) > 0).length;
      const subjectsWithoutSessions = totalAssignedSubjects - subjectsWithSessions;

      const totalRecordedSessions = subjectRows.reduce((sum, r) => sum + Number(r.totalSessions || 0), 0);
      const totalAttendedSessions = subjectRows.reduce((sum, r) => sum + Number(r.attendedSessions || 0), 0);

      const hasRecordedSessions = totalRecordedSessions > 0;
      const attendancePercentage = hasRecordedSessions
        ? Math.round((totalAttendedSessions / totalRecordedSessions) * 1000) / 10
        : null;

      let coverageCategory = 'NO_SESSIONS_RECORDED';
      let staffNotice = null;

      if (!hasRecordedSessions) {
        coverageCategory = 'NO_SESSIONS_RECORDED';
        staffNotice = 'Notice: No attendance sessions recorded in the portal for this cohort. Certificate will state attendance as N/A.';
      } else if (subjectsWithSessions === totalAssignedSubjects) {
        coverageCategory = 'COMPLETE';
      } else {
        coverageCategory = 'INCOMPLETE';
        staffNotice = `Notice: Attendance recorded for ${subjectsWithSessions} of ${totalAssignedSubjects} assigned subjects (${totalRecordedSessions} sessions total). Percentage reflects portal-recorded sessions only.`;
      }

      // Conservative default: if zero sessions recorded, block approval until policy confirmed
      const canApprove = hasRecordedSessions;
      const blockReason = !canApprove
        ? 'Zero attendance sessions recorded in the portal for this cohort. Approval is blocked pending institutional policy confirmation.'
        : null;

      const generatedAttendance = hasRecordedSessions
        ? `${attendancePercentage}%`
        : 'N/A';

      return {
        success: true,
        totalAssignedSubjects,
        subjectsWithSessions,
        subjectsWithoutSessions,
        totalRecordedSessions,
        totalAttendedSessions,
        attendancePercentage,
        generatedAttendance,
        coverageCategory,
        staffNotice,
        canApprove,
        blockReason
      };
    } catch (error) {
      logger.error({ err: error, studentId, branch, semester, academicYear }, '[ATTENDANCE_CALCULATION_SERVICE_ERROR]');
      return {
        success: false,
        canApprove: false,
        blockReason: 'Internal error calculating student attendance.',
        generatedAttendance: 'N/A'
      };
    }
  }
}

export default AttendanceCalculationService;

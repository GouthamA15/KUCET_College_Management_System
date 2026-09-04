import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  facultySubjectAssignments, 
  studentAttendance, 
  attendanceSessionLogs, 
  attendanceSessions 
} from '@/db/schema';
import { eq, and, asc, _sql } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(request) {
  try {
    const user = await getAuthUser('faculty');
    if (!user || (user.role !== 'faculty' && user.role !== 'admin')) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const assignment_id = searchParams.get('assignment_id') ? parseInt(searchParams.get('assignment_id')) : null;
    const date = searchParams.get('date');
    const session = searchParams.get('session') ? parseInt(searchParams.get('session')) : 1;

    if (!assignment_id || !date) {
      return apiError('assignment_id and date are required', 400);
    }

    // Verify assignment exists
    const assignments = await db.select({
      id: facultySubjectAssignments.id,
      subject_code: facultySubjectAssignments.subject_code,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      academic_year: facultySubjectAssignments.academic_year,
      faculty_id: facultySubjectAssignments.staff_account_id
    })
    .from(facultySubjectAssignments)
    .where(eq(facultySubjectAssignments.id, assignment_id))
    .limit(1);

    if (assignments.length === 0) {
      return apiError('Assignment not found', 404);
    }

    const assignment = assignments[0];

    // Authorization: primary faculty, HOD, substitute, or admin
    let isAuthorized = false;
    if (assignment.faculty_id === user.id || user.role === 'admin') {
      isAuthorized = true;
    } else if (user.is_hod && user.branch === assignment.branch) {
      isAuthorized = true;
    } else {
      const { facultySubstitutions } = await import('@/db/schema');
      const substitution = await db.select({ id: facultySubstitutions.id })
        .from(facultySubstitutions)
        .where(and(
          eq(facultySubstitutions.original_assignment_id, assignment_id),
          eq(facultySubstitutions.substitute_faculty_id, user.id)
        ))
        .limit(1);
      if (substitution.length > 0) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return apiError('Unauthorized to view attendance for this assignment', 403);
    }

    const { subject_code, branch, course_semester, academic_year } = assignment;

    // --- SHARED DATA LOGIC: Canonical ID ---
    const canonicalRows = await db.select({ id: facultySubjectAssignments.id })
      .from(facultySubjectAssignments)
      .where(and(
        eq(facultySubjectAssignments.subject_code, subject_code),
        eq(facultySubjectAssignments.branch, branch),
        eq(facultySubjectAssignments.course_semester, course_semester),
        eq(facultySubjectAssignments.academic_year, academic_year)
      ))
      .orderBy(asc(facultySubjectAssignments.created_at))
      .limit(1);
    
    const targetAssignmentId = canonicalRows[0]?.id || assignment_id;

    // Lightweight fetch of attendance statuses for the specific date+session
    const rows = await db.select({
      student_id: studentAttendance.student_id,
      status: studentAttendance.status
    })
    .from(studentAttendance)
    .where(and(
      eq(studentAttendance.assignment_id, targetAssignmentId),
      eq(studentAttendance.date, date),
      eq(studentAttendance.session, session)
    ));

    // Also return which sessions have records for this date
    const sessRows = await db.select({ session: studentAttendance.session })
      .from(studentAttendance)
      .where(and(
        eq(studentAttendance.assignment_id, targetAssignmentId),
        eq(studentAttendance.date, date)
      ))
      .groupBy(studentAttendance.session)
      .orderBy(asc(studentAttendance.session));

    const sessions = sessRows.map(r => r.session);

    // Fetch topic_covered for this assignment, date, and session
    const sessionTopicRows = await db.select({
      topic_covered: attendanceSessions.topic_covered
    })
    .from(attendanceSessions)
    .where(and(
      eq(attendanceSessions.assignment_id, assignment_id),
      eq(attendanceSessions.attendance_date, date),
      eq(attendanceSessions.session_number, session)
    ))
    .limit(1);

    const topic_covered = sessionTopicRows[0]?.topic_covered || null;

    // --- FETCH SELF-VERIFIED STUDENTS ---
    const logRows = await db.select({ student_id: attendanceSessionLogs.student_id })
      .from(attendanceSessionLogs)
      .innerJoin(attendanceSessions, eq(attendanceSessionLogs.session_id, attendanceSessions.id))
      .where(and(
        eq(attendanceSessions.assignment_id, assignment_id),
        eq(attendanceSessions.attendance_date, date),
        eq(attendanceSessions.is_active, true),
        eq(attendanceSessionLogs.status, 'SUCCESS')
      ));

    const verified_ids = logRows.map(r => r.student_id);

    return apiResponse({ data: rows, sessions, verified_ids, topic_covered });
  } catch (error) {
    logger.error('Attendance Status Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

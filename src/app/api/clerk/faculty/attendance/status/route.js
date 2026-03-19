import { db } from '@/db';
import { 
  facultySubjectAssignments, 
  studentAttendance, 
  attendanceSessionLogs, 
  attendanceSessions 
} from '@/db/schema';
import { eq, and, asc, sql } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(request) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty') {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const assignment_id = searchParams.get('assignment_id') ? parseInt(searchParams.get('assignment_id')) : null;
    const date = searchParams.get('date');
    const session = searchParams.get('session') ? parseInt(searchParams.get('session')) : 1;

    if (!assignment_id || !date) {
      return apiError('assignment_id and date are required', 400);
    }

    // Verify assignment belongs to faculty
    const assignments = await db.select({
      id: facultySubjectAssignments.id,
      subject_code: facultySubjectAssignments.subject_code,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      academic_year: facultySubjectAssignments.academic_year
    })
    .from(facultySubjectAssignments)
    .where(and(
      eq(facultySubjectAssignments.id, assignment_id),
      eq(facultySubjectAssignments.faculty_id, user.id)
    ))
    .limit(1);

    if (assignments.length === 0) {
      return apiError('Assignment not found or unauthorized', 404);
    }

    const assignment = assignments[0];
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

    return apiResponse({ data: rows, sessions, verified_ids });
  } catch (error) {
    console.error('Attendance Status Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

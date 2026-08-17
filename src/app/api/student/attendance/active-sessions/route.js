import logger from '@/lib/logger';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { db } from '@/db';
import { 
  facultySubjectAssignments, 
  attendanceSessions, 
  staffAccounts, 
  attendanceSessionLogs 
} from '@/db/schema';
import { eq, and, inArray, isNull, _sql, gt } from 'drizzle-orm';

/**
 * GET /api/student/attendance/active-sessions?ids=1,2,3
 * Returns active attendance sessions for the provided assignment IDs
 */
export async function GET(request) {
  try {
    const user = await getAuthUser('student');
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const ids = searchParams.get('ids');

    if (!ids) {
      return apiResponse({ data: [] });
    }

    const assignmentIds = ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
    if (assignmentIds.length === 0) {
      return apiResponse({ data: [] });
    }

    // 1. First, find the subject codes, branch, and semester for the provided assignment IDs
    const contextRows = await db.select({
      subject_code: facultySubjectAssignments.subject_code,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      academic_year: facultySubjectAssignments.academic_year
    })
    .from(facultySubjectAssignments)
    .where(inArray(facultySubjectAssignments.id, assignmentIds));

    if (contextRows.length === 0) {
      return apiResponse({ data: [] });
    }

    const subjectCodes = Array.from(new Set(contextRows.map(r => r.subject_code)));
    const branch = contextRows[0].branch;
    const semester = contextRows[0].course_semester;
    const academicYear = contextRows[0].academic_year;

    // 2. Fetch ALL active sessions for these subjects in this branch/sem/year
    // AND check if this student has already verified.
    const { getNow } = await import('@/lib/clock');
    const sessions = await db.select({
      session_id: attendanceSessions.id,
      assignment_id: attendanceSessions.assignment_id,
      attendance_date: attendanceSessions.attendance_date,
      subject_name: facultySubjectAssignments.subject_name,
      subject_code: facultySubjectAssignments.subject_code,
      faculty_name: staffAccounts.name
    })
    .from(attendanceSessions)
    .innerJoin(facultySubjectAssignments, eq(attendanceSessions.assignment_id, facultySubjectAssignments.id))
    .innerJoin(staffAccounts, eq(attendanceSessions.faculty_id, staffAccounts.id))
    .leftJoin(attendanceSessionLogs, and(
      eq(attendanceSessions.id, attendanceSessionLogs.session_id),
      eq(attendanceSessionLogs.student_id, user.student_id),
      eq(attendanceSessionLogs.status, 'SUCCESS')
    ))
    .where(and(
      inArray(facultySubjectAssignments.subject_code, subjectCodes),
      eq(facultySubjectAssignments.branch, branch),
      eq(facultySubjectAssignments.course_semester, semester),
      eq(facultySubjectAssignments.academic_year, academicYear),
      eq(attendanceSessions.is_active, true),
      gt(attendanceSessions.expires_at, getNow()),
      isNull(attendanceSessionLogs.id)
    ));

    return apiResponse({ data: sessions });
  } catch (error) {
    logger.error('Fetch Active Sessions Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

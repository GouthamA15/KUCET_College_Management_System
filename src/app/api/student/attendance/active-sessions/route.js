import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { getDb } from '@/lib/db';

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

    const db = getDb();

    // 1. First, find the subject codes, branch, and semester for the provided assignment IDs
    // This allows us to find sessions started by ANY faculty for these specific subjects.
    const [contextRows] = await db.execute(
      `SELECT DISTINCT subject_code, branch, course_semester, academic_year 
       FROM faculty_subject_assignments 
       WHERE id IN (${assignmentIds.map(() => '?').join(',')})`,
      assignmentIds
    );

    if (contextRows.length === 0) {
      return apiResponse({ data: [] });
    }

    const subjectCodes = contextRows.map(r => r.subject_code);
    const branch = contextRows[0].branch;
    const semester = contextRows[0].course_semester;
    const academicYear = contextRows[0].academic_year;

    // 2. Fetch ALL active sessions for these subjects in this branch/sem/year
    // AND check if this student has already verified.
    const [sessions] = await db.execute(
      `SELECT 
        asess.id as session_id,
        asess.assignment_id, 
        asess.attendance_date,
        fsa.subject_name, 
        fsa.subject_code,
        c.name as faculty_name
       FROM attendance_sessions asess
       JOIN faculty_subject_assignments fsa ON asess.assignment_id = fsa.id
       JOIN clerks c ON asess.faculty_id = c.id
       LEFT JOIN attendance_session_logs asl ON asess.id = asl.session_id AND asl.student_id = ? AND asl.status = 'SUCCESS'
       WHERE fsa.subject_code IN (${subjectCodes.map(() => '?').join(',')})
       AND fsa.branch = ?
       AND fsa.course_semester = ?
       AND fsa.academic_year = ?
       AND asess.is_active = 1 
       AND asess.expires_at > NOW()
       AND asl.id IS NULL`, 
      [user.student_id, ...subjectCodes, branch, semester, academicYear]
    );

    return apiResponse({ data: sessions });
  } catch (error) {
    console.error('Fetch Active Sessions Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

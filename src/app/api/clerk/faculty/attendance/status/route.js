import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { getDb } from '@/lib/db';

export async function GET(request) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty') {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const assignment_id = searchParams.get('assignment_id');
    const date = searchParams.get('date');
    const session = searchParams.get('session') || 1;

    if (!assignment_id || !date) {
      return apiError('assignment_id and date are required', 400);
    }

    const db = getDb();
    // Verify assignment belongs to faculty
    const [assignments] = await db.execute(
      'SELECT id, subject_code, branch, course_semester, academic_year FROM faculty_subject_assignments WHERE id = ? AND faculty_id = ?',
      [assignment_id, user.id]
    );

    if (assignments.length === 0) {
      return apiError('Assignment not found or unauthorized', 404);
    }

    const assignment = assignments[0];
    const { subject_code, branch, course_semester, academic_year } = assignment;

    // --- SHARED DATA LOGIC: Canonical ID ---
    const [canonicalRows] = await db.execute(`
      SELECT id FROM faculty_subject_assignments 
      WHERE subject_code = ? AND branch = ? AND course_semester = ? AND academic_year = ?
      ORDER BY created_at ASC LIMIT 1
    `, [subject_code, branch, course_semester, academic_year]);
    
    const targetAssignmentId = canonicalRows[0]?.id || assignment_id;

    // Lightweight fetch of attendance statuses for the specific date+session using target ID
    const [rows] = await db.execute(
      'SELECT student_id, status FROM student_attendance WHERE assignment_id = ? AND date = ? AND session = ?',
      [targetAssignmentId, date, session]
    );

    // Also return which sessions have records for this date (for UI session buttons)
    const [sessRows] = await db.execute(
      'SELECT DISTINCT session FROM student_attendance WHERE assignment_id = ? AND date = ? ORDER BY session ASC',
      [targetAssignmentId, date]
    );

    const sessions = sessRows.map(r => r.session);

    // --- FETCH SELF-VERIFIED STUDENTS ---
    // Look for successful logs in the active session for THIS specific assignment
    const [logRows] = await db.execute(`
      SELECT student_id 
      FROM attendance_session_logs asl
      JOIN attendance_sessions asess ON asl.session_id = asess.id
      WHERE asess.assignment_id = ? AND asess.is_active = 1 AND asl.status = 'SUCCESS'
    `, [assignment_id]);

    const verified_ids = logRows.map(r => r.student_id);

    return apiResponse({ data: rows, sessions, verified_ids });
  } catch (error) {
    console.error('Attendance Status Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

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
      'SELECT * FROM faculty_subject_assignments WHERE id = ? AND faculty_id = ?',
      [assignment_id, user.id]
    );

    if (assignments.length === 0) {
      return apiError('Assignment not found or unauthorized', 404);
    }

    // Lightweight fetch of attendance statuses for the specific date+session
    const [rows] = await db.execute(
      'SELECT student_id, status FROM student_attendance WHERE assignment_id = ? AND date = ? AND session = ?',
      [assignment_id, date, session]
    );

    // Also return which sessions have records for this date (for UI session buttons)
    const [sessRows] = await db.execute(
      'SELECT DISTINCT session FROM student_attendance WHERE assignment_id = ? AND date = ? ORDER BY session ASC',
      [assignment_id, date]
    );

    const sessions = sessRows.map(r => r.session);

    return apiResponse({ data: rows, sessions });
  } catch (error) {
    console.error('Attendance Status Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

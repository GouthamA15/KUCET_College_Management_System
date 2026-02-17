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
    const student_id = searchParams.get('student_id');

    if (!assignment_id) {
      return apiError('Assignment ID is required', 400);
    }

    const db = getDb();

    // If student_id is provided, fetch history for ONE student (existing functionality)
    if (student_id) {
      const [history] = await db.execute(
        "SELECT DATE_FORMAT(date, '%Y-%m-%d') as date, status, session FROM student_attendance WHERE student_id = ? AND assignment_id = ? ORDER BY date DESC, session DESC",
        [student_id, assignment_id]
      );
      return apiResponse({ data: history });
    }

    // If no student_id, fetch FULL GRID DATA for all students in this assignment
    const [attendance] = await db.execute(
      "SELECT student_id, DATE_FORMAT(date, '%Y-%m-%d') as date, session, status FROM student_attendance WHERE assignment_id = ? ORDER BY date ASC, session ASC",
      [assignment_id]
    );

    // Get unique dates/sessions for columns
    const [uniqueDates] = await db.execute(
      "SELECT DISTINCT DATE_FORMAT(date, '%Y-%m-%d') as date, session FROM student_attendance WHERE assignment_id = ? ORDER BY date ASC, session ASC",
      [assignment_id]
    );

    return apiResponse({ 
      attendance, 
      uniqueDates 
    });
  } catch (error) {
    console.error('Attendance Full History Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

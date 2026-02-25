import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { getDb } from '@/lib/db';

export async function GET(request) {
  try {
    const user = await getAuthUser('student');
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const assignment_id = searchParams.get('assignment_id');

    if (!assignment_id) {
      return apiError('Assignment ID is required', 400);
    }

    const db = getDb();
    const [history] = await db.execute(
      'SELECT date, status, slot as session FROM student_attendance WHERE student_id = ? AND assignment_id = ? ORDER BY date DESC, slot DESC',
      [user.student_id, assignment_id]
    );

    return apiResponse({ data: history });
  } catch (error) {
    console.error('Student Attendance History Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

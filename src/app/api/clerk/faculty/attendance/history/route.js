import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { getDb } from '@/lib/db';

export async function GET(request) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty') {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const student_id = searchParams.get('student_id');
    const assignment_id = searchParams.get('assignment_id');

    if (!student_id || !assignment_id) {
      return apiError('Missing required parameters', 400);
    }

    const db = getDb();
    const [history] = await db.execute(
      'SELECT date, status FROM student_attendance WHERE student_id = ? AND assignment_id = ? ORDER BY date DESC',
      [student_id, assignment_id]
    );

    return apiResponse({ data: history });
  } catch (error) {
    console.error('Attendance History Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

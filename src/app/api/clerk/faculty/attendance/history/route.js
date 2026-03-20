import logger from '@/lib/logger';
import { db } from '@/db';
import { studentAttendance } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(request) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty') {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const student_id = searchParams.get('student_id') ? parseInt(searchParams.get('student_id')) : null;
    const assignment_id = searchParams.get('assignment_id') ? parseInt(searchParams.get('assignment_id')) : null;

    if (!student_id || !assignment_id) {
      return apiError('Missing required parameters', 400);
    }

    const history = await db.select({
      date: studentAttendance.date,
      status: studentAttendance.status,
      session: studentAttendance.session
    })
    .from(studentAttendance)
    .where(and(
      eq(studentAttendance.student_id, student_id),
      eq(studentAttendance.assignment_id, assignment_id)
    ))
    .orderBy(desc(studentAttendance.date), desc(studentAttendance.session));

    return apiResponse({ data: history });
  } catch (error) {
    logger.error('Attendance History Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

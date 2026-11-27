import logger from '@/lib/logger';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { db } from '@/db';
import { studentAttendance, attendanceSessions } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(request) {
  try {
    const user = await getAuthUser('student');
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const assignment_id = searchParams.get('assignment_id');
    const assignmentIdNum = parseInt(assignment_id || '', 10);

    if (!assignment_id || !Number.isInteger(assignmentIdNum) || assignmentIdNum <= 0) {
      return apiError('Valid Assignment ID is required', 400);
    }

    const history = await db.select({
      date: studentAttendance.date,
      status: studentAttendance.status,
      session: studentAttendance.session,
      batch_number: attendanceSessions.batch_number
    })
    .from(studentAttendance)
    .leftJoin(attendanceSessions, eq(studentAttendance.session_id, attendanceSessions.id))
    .where(and(
      eq(studentAttendance.student_id, user.student_id),
      eq(studentAttendance.assignment_id, assignmentIdNum)
    ))
    .orderBy(desc(studentAttendance.date), desc(studentAttendance.session), desc(studentAttendance.id));

    return apiResponse({ data: history });
  } catch (error) {
    logger.error('Student Attendance History Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

import logger from '@/lib/logger';
import { db } from '@/db';
import { studentAttendance } from '@/db/schema';
import { eq, and, asc, desc, sql } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(request) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty') {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const assignment_id = searchParams.get('assignment_id') ? parseInt(searchParams.get('assignment_id')) : null;
    const student_id = searchParams.get('student_id') ? parseInt(searchParams.get('student_id')) : null;

    if (!assignment_id) {
      return apiError('Assignment ID is required', 400);
    }

    // If student_id is provided, fetch history for ONE student
    if (student_id) {
      const history = await db.select({
        date: sql`DATE_FORMAT(${studentAttendance.date}, '%Y-%m-%d')`,
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
    }

    // If no student_id, fetch FULL GRID DATA for all students in this assignment
    const attendance = await db.select({
      student_id: studentAttendance.student_id,
      date: sql`DATE_FORMAT(${studentAttendance.date}, '%Y-%m-%d')`,
      session: studentAttendance.session,
      status: studentAttendance.status
    })
    .from(studentAttendance)
    .where(eq(studentAttendance.assignment_id, assignment_id))
    .orderBy(asc(studentAttendance.date), asc(studentAttendance.session));

    // Get unique dates/sessions for columns
    const uniqueDates = await db.select({
      date: sql`DATE_FORMAT(${studentAttendance.date}, '%Y-%m-%d')`,
      session: studentAttendance.session
    })
    .from(studentAttendance)
    .where(eq(studentAttendance.assignment_id, assignment_id))
    .groupBy(studentAttendance.date, studentAttendance.session)
    .orderBy(asc(studentAttendance.date), asc(studentAttendance.session));

    return apiResponse({ 
      attendance, 
      uniqueDates 
    });
  } catch (error) {
    logger.error('Attendance Full History Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { db } from '@/db';
import { studentAttendance } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

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

    const history = await db.query.studentAttendance.findMany({
      columns: {
        date: true,
        status: true,
        session: true
      },
      where: and(
        eq(studentAttendance.student_id, user.student_id),
        eq(studentAttendance.assignment_id, parseInt(assignment_id))
      ),
      orderBy: [desc(studentAttendance.date), desc(studentAttendance.session)]
    });

    return apiResponse({ data: history });
  } catch (error) {
    console.error('Student Attendance History Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

import logger from '@/lib/logger';
import { db } from '@/db';
import { studentAttendance, students, attendanceSessions, facultySubjectAssignments } from '@/db/schema';
import { eq, and, asc, desc, sql } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(request) {
  try {
    const user = await getAuthUser('faculty');
    if (!user || (user.role !== 'faculty' && user.role !== 'admin')) {
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
      roll_no: students.roll_no,
      name: students.name,
      date: sql`DATE_FORMAT(${studentAttendance.date}, '%Y-%m-%d')`,
      session: studentAttendance.session,
      status: studentAttendance.status
    })
    .from(studentAttendance)
    .innerJoin(students, eq(studentAttendance.student_id, students.id))
    .where(eq(studentAttendance.assignment_id, assignment_id))
    .orderBy(asc(studentAttendance.date), asc(studentAttendance.session));

    // 1. Fetch assignment details to get academic_year and course_semester
    const assignments = await db.select({
      academic_year: facultySubjectAssignments.academic_year,
      course_semester: facultySubjectAssignments.course_semester
    })
    .from(facultySubjectAssignments)
    .where(eq(facultySubjectAssignments.id, assignment_id))
    .limit(1);

    if (assignments.length === 0) {
      return apiError('Assignment not found', 404);
    }
    const assignment = assignments[0];

    // Get all generated dates for this semester from the Academic Calendar
    const { academicCalendar } = await import('@/db/schema');
    
    // We also need topic_covered for these dates
    // Since topic_covered is per session, and calendar is per day, 
    // we fetch calendar dates and left join sessions.
    const uniqueDates = await db.select({
      date: sql`DATE_FORMAT(${academicCalendar.date}, '%Y-%m-%d')`,
      day_type: academicCalendar.day_type,
      holiday_name: academicCalendar.holiday_name,
      session: sql`COALESCE(${attendanceSessions.session_number}, 1)`.mapWith(Number),
      topic_covered: attendanceSessions.topic_covered
    })
    .from(academicCalendar)
    .leftJoin(attendanceSessions, and(
      eq(attendanceSessions.assignment_id, assignment_id),
      eq(attendanceSessions.attendance_date, sql`DATE_FORMAT(${academicCalendar.date}, '%Y-%m-%d')`)
    ))
    .where(and(
      eq(academicCalendar.academic_year, assignment.academic_year),
      eq(academicCalendar.semester, assignment.course_semester)
    ))
    .orderBy(asc(academicCalendar.date), asc(sql`COALESCE(${attendanceSessions.session_number}, 1)`));

    return apiResponse({ 
      data: {
        attendance, 
        uniqueDates 
      }
    });
  } catch (error) {
    logger.error('Attendance Full History Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

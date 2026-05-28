import logger from '@/lib/logger';
import { db } from '@/db';
import { students, studentAttendance, facultySubjectAssignments, semesters } from '@/db/schema';
import { eq, and, sql, desc, asc, like, or } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  let user;
  try {
    user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty' || !user.is_hod) {
      return apiError('Unauthorized', 401);
    }

    if (!user.branch) {
      return apiError('Branch not assigned to your profile', 400);
    }

    const { searchParams } = new URL(req.url);
    const semester = parseInt(searchParams.get('semester') || '6', 10);

    // Resolve system year
    const latestSem = await db.query.semesters.findFirst({
        orderBy: desc(semesters.id)
    });
    const systemYear = latestSem?.academic_year || '2025-26';

    const percentageExpr = sql`ROUND((COUNT(CASE WHEN ${studentAttendance.status} = 'PRESENT' AND ${studentAttendance.date} >= COALESCE(${students.admission_date}, '1900-01-01') THEN 1 END) / COUNT(CASE WHEN ${studentAttendance.date} >= COALESCE(${students.admission_date}, '1900-01-01') THEN ${studentAttendance.id} END)) * 100, 1)`;
    
    const risks = await db.select({
        roll_no: students.roll_no,
        name: students.name,
        total_present: sql`COUNT(CASE WHEN ${studentAttendance.status} = 'PRESENT' AND ${studentAttendance.date} >= COALESCE(${students.admission_date}, '1900-01-01') THEN 1 END)`.mapWith(Number),
        total_sessions_recorded: sql`(
          SELECT COUNT(*) 
          FROM student_attendance sa2 
          JOIN faculty_subject_assignments fsa2 ON sa2.assignment_id = fsa2.id
          JOIN students s2 ON sa2.student_id = s2.id
          WHERE sa2.student_id = ${students.id} 
          AND fsa2.course_semester = ${semester} 
          AND fsa2.branch = ${user.branch}
          AND sa2.date >= COALESCE(s2.admission_date, '1900-01-01')
        )`.mapWith(Number),
        percentage: percentageExpr.mapWith(Number)
    })
    .from(students)
    .innerJoin(studentAttendance, eq(students.id, studentAttendance.student_id))
    .innerJoin(facultySubjectAssignments, eq(studentAttendance.assignment_id, facultySubjectAssignments.id))
    .where(and(
        eq(facultySubjectAssignments.branch, user.branch),
        eq(facultySubjectAssignments.course_semester, semester),
        or(
            like(facultySubjectAssignments.academic_year, `%${systemYear.substring(0, 4)}%`),
            eq(facultySubjectAssignments.academic_year, '2025-26')
        )
    ))
    .groupBy(students.id, students.roll_no, students.name)
    .having(sql`${percentageExpr} < 75`)
    .orderBy(asc(percentageExpr));

    return apiResponse({ 
      data: risks,
      threshold: 75,
      branch: user.branch,
      semester 
    });
  } catch (error) {
    logger.error({ err: error, user: user?.email, branch: user?.branch }, 'Attendance Analytics API Error');
    return apiError('Internal Server Error', 500, error.message);
  }
}

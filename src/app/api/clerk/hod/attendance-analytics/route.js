import { db } from '@/db';
import { students, studentAttendance, facultySubjectAssignments, semesters } from '@/db/schema';
import { eq, and, sql, desc, like, or } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty' || !user.is_hod) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(req.url);
    const semester = parseInt(searchParams.get('semester') || '6', 10);

    // Resolve system year
    const latestSem = await db.query.semesters.findFirst({
        orderBy: desc(semesters.id)
    });
    const systemYear = latestSem?.academic_year || '2025-26';

    /**
     * This query calculates:
     * 1. Total sessions conducted for each student in this branch/sem
     * 2. Total sessions attended by each student
     * 3. Overall percentage across all subjects
     */
    
    // Subquery for total sessions recorded for the specific student in branch/sem
    // In Drizzle we can use a raw SQL snippet for complex aggregations if needed
    
    const risks = await db.select({
        roll_no: students.roll_no,
        name: students.name,
        total_present: sql`COUNT(${studentAttendance.id})`,
        total_sessions_recorded: sql`(
          SELECT COUNT(*) 
          FROM student_attendance sa2 
          JOIN faculty_subject_assignments fsa2 ON sa2.assignment_id = fsa2.id
          WHERE sa2.student_id = ${students.id} 
          AND fsa2.course_semester = ${semester} 
          AND fsa2.branch = ${user.branch}
        )`,
        percentage: sql`ROUND((COUNT(CASE WHEN ${studentAttendance.status} = 'PRESENT' THEN 1 END) / COUNT(${studentAttendance.id})) * 100, 1)`
    })
    .from(students)
    .join(studentAttendance, eq(students.id, studentAttendance.student_id))
    .join(facultySubjectAssignments, eq(studentAttendance.assignment_id, facultySubjectAssignments.id))
    .where(and(
        eq(facultySubjectAssignments.branch, user.branch),
        eq(facultySubjectAssignments.course_semester, semester),
        or(
            like(facultySubjectAssignments.academic_year, `%${systemYear.substring(0, 4)}%`),
            eq(facultySubjectAssignments.academic_year, '2025-26')
        )
    ))
    .groupBy(students.id, students.roll_no, students.name)
    .having(({ percentage }) => sql`${percentage} < 75`)
    .orderBy(sql`percentage ASC`);

    return apiResponse({ 
      data: risks,
      threshold: 75,
      branch: user.branch,
      semester 
    });
  } catch (error) {
    console.error('Attendance Analytics API Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

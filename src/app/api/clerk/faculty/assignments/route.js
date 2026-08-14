import logger from '@/lib/logger';
import { db } from '@/db';
import { facultySubjectAssignments } from '@/db/schema';
import { eq, _and, desc, asc, _sql } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { getCurrentCalendarSession } from '@/lib/academic-utils';

export async function GET(_request) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty') {
      return apiError('Unauthorized', 401);
    }

    const assignments = await db.select({
      id: facultySubjectAssignments.id,
      faculty_id: facultySubjectAssignments.faculty_id,
      subject_code: facultySubjectAssignments.subject_code,
      subject_name: facultySubjectAssignments.subject_name,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      semester: facultySubjectAssignments.course_semester,
      academic_term: facultySubjectAssignments.academic_term,
      academic_year: facultySubjectAssignments.academic_year,
      created_at: facultySubjectAssignments.created_at,
      is_active: facultySubjectAssignments.is_active,
      mid_max: facultySubjectAssignments.mid_max
    })
    .from(facultySubjectAssignments)
    .where(eq(facultySubjectAssignments.faculty_id, user.id))
    .orderBy(desc(facultySubjectAssignments.academic_year), asc(facultySubjectAssignments.course_semester));

    const session = await getCurrentCalendarSession();

    const assignmentsWithActivity = assignments.map((asgn) => {
      let active = false;
      if (session) {
        active = session.academicYear === asgn.academic_year && (session.semester % 2 === asgn.course_semester % 2);
      }
      return {
        ...asgn,
        is_active: active
      };
    });

    return apiResponse({ data: assignmentsWithActivity });
  } catch (error) {
    logger.error('Assignments Fetch Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

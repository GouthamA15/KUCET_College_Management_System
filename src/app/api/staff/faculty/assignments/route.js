import logger from '@/lib/logger';
import { db } from '@/db';
import { facultySubjectAssignments, facultySubstitutions } from '@/db/schema';
import { eq, and, or, desc, asc, inArray } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { getCurrentCalendarSession } from '@/lib/academic-utils';

export async function GET(request) {
  try {
    const user = await getAuthUser('faculty');
    if (!user || (user.role !== 'faculty' && user.role !== 'admin')) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const requestedId = searchParams.get('id') || searchParams.get('assignment_id');
    const specificId = requestedId ? parseInt(requestedId, 10) : null;

    let assignments = [];

    if (user.role === 'admin') {
      const query = db.select({
        id: facultySubjectAssignments.id,
        staff_account_id: facultySubjectAssignments.staff_account_id,
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
      .from(facultySubjectAssignments);

      if (specificId) {
        assignments = await query.where(eq(facultySubjectAssignments.id, specificId));
      } else {
        assignments = await query.orderBy(desc(facultySubjectAssignments.academic_year), asc(facultySubjectAssignments.course_semester));
      }
    } else {
      // Find substitute assignment IDs for this faculty
      const subRows = await db.select({
        assignment_id: facultySubstitutions.original_assignment_id
      })
      .from(facultySubstitutions)
      .where(eq(facultySubstitutions.substitute_faculty_id, user.id));

      const subIds = subRows.map(r => r.assignment_id).filter(Boolean);

      const conditions = [eq(facultySubjectAssignments.staff_account_id, user.id)];

      if (subIds.length > 0) {
        conditions.push(inArray(facultySubjectAssignments.id, subIds));
      }

      if (user.is_hod && user.branch) {
        conditions.push(eq(facultySubjectAssignments.branch, user.branch));
      }

      const baseQuery = db.select({
        id: facultySubjectAssignments.id,
        staff_account_id: facultySubjectAssignments.staff_account_id,
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
      .from(facultySubjectAssignments);

      if (specificId) {
        assignments = await baseQuery.where(and(
          eq(facultySubjectAssignments.id, specificId),
          or(...conditions)
        ));
      } else {
        assignments = await baseQuery.where(or(...conditions))
          .orderBy(desc(facultySubjectAssignments.academic_year), asc(facultySubjectAssignments.course_semester));
      }
    }

    const session = await getCurrentCalendarSession();

    const assignmentsWithActivity = assignments.map((asgn) => {
      let active = asgn.is_active !== false;
      if (session && session.academicYear) {
        active = (session.academicYear === asgn.academic_year && (session.semester % 2 === asgn.course_semester % 2));
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

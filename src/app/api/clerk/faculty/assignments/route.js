import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { getDb } from '@/lib/db';
import { isSemesterActive } from '@/lib/academic-utils';

export async function GET(request) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty') {
      return apiError('Unauthorized', 401);
    }

    const db = getDb();
    const [assignments] = await db.execute(
      'SELECT *, course_semester AS semester FROM faculty_subject_assignments WHERE faculty_id = ? ORDER BY academic_year DESC, course_semester ASC',
      [user.id]
    );

    // Get college info for activity check
    const [collegeInfoRows] = await db.execute('SELECT * FROM college_info WHERE id = 1');
    const collegeInfo = collegeInfoRows[0] || null;

    const assignmentsWithActivity = await Promise.all(assignments.map(async (asgn) => ({
      ...asgn,
      // course_semester is the stored column; we still use its
      // odd/even nature to determine whether the assignment is
      // currently active within the academic year.
      is_active: await isSemesterActive(asgn.course_semester, asgn.academic_year, collegeInfo)
    })));

    return apiResponse({ data: assignmentsWithActivity });
  } catch (error) {
    console.error('Assignments Fetch Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

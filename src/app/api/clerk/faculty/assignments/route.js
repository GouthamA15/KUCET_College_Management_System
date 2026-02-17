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
      'SELECT * FROM faculty_subject_assignments WHERE faculty_id = ? ORDER BY academic_year DESC, semester ASC',
      [user.id]
    );

    // Get college info for activity check
    const [collegeInfoRows] = await db.execute('SELECT * FROM college_info WHERE id = 1');
    const collegeInfo = collegeInfoRows[0] || null;

    const assignmentsWithActivity = assignments.map(asgn => ({
      ...asgn,
      is_active: isSemesterActive(asgn.semester, asgn.academic_year, collegeInfo)
    }));

    return apiResponse({ data: assignmentsWithActivity });
  } catch (error) {
    console.error('Assignments Fetch Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

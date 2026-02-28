import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { getDb } from '@/lib/db';
import { getCollegeAcademicYear } from '@/lib/academic-utils';

export async function GET(request) {
  try {
    const user = await getAuthUser('admin');
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const db = getDb();
    
    // Get current academic year using central logic
    const [collegeInfoRows] = await db.execute('SELECT * FROM college_info WHERE id = 1');
    const collegeInfo = collegeInfoRows[0] || null;
    const currentAcademicYear = await getCollegeAcademicYear(collegeInfo);

    // Fetch interests for current year (all semesters) + any pending from previous years
    // Join with assignments to see if subject is already allocated
    const [interests] = await db.execute(`
      SELECT 
        fsi.*, 
        c.name as faculty_name, 
        c.employee_id,
        (SELECT c2.name FROM faculty_subject_assignments fsa 
         JOIN clerks c2 ON fsa.faculty_id = c2.id
         WHERE fsa.subject_code = fsi.subject_code 
         AND fsa.branch = fsi.branch 
         AND fsa.course_semester = fsi.semester 
         AND fsa.academic_year = fsi.academic_year
         LIMIT 1) as allocated_faculty_name
      FROM faculty_subject_interests fsi
      JOIN clerks c ON fsi.faculty_id = c.id
      WHERE fsi.academic_year = ? OR fsi.status = 'PENDING'
      ORDER BY fsi.status = 'PENDING' DESC, fsi.created_at DESC
    `, [currentAcademicYear]);

    return apiResponse({ data: interests });
  } catch (error) {
    console.error('Admin Interests Fetch Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

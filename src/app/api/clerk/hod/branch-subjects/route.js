import { query } from '@/lib/db';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty' || !user.is_hod) {
      return apiError('Unauthorized', 401);
    }

    // Get all subjects associated with this branch across all semesters
    const sql = `
      SELECT DISTINCT 
        s.subject_code, 
        s.subject_name, 
        s.subject_type,
        ss.semester
      FROM syllabus_subjects s
      JOIN syllabus_structure ss ON s.subject_code = ss.subject_code
      WHERE ss.branch = ?
      ORDER BY ss.semester, s.subject_name
    `;

    const subjects = await query(sql, [user.branch]);

    return apiResponse({ data: subjects });
  } catch (error) {
    console.error('Branch Subjects API Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

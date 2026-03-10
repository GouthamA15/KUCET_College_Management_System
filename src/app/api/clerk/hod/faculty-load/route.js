import { query } from '@/lib/db';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty' || !user.is_hod) {
      return apiError('Unauthorized', 401);
    }

    // Get all faculty in the branch and their assigned periods from the timetable
    const sql = `
      SELECT 
        c.id, 
        c.name, 
        c.email,
        COUNT(bt.id) as weekly_periods,
        (COUNT(bt.id) * 50) / 60 as weekly_hours
      FROM clerks c
      LEFT JOIN branch_timetable bt ON c.id = bt.faculty_id 
        AND bt.branch = ? 
        AND bt.academic_year = (SELECT academic_year FROM semesters ORDER BY id DESC LIMIT 1)
      WHERE c.role = 'faculty'
      GROUP BY c.id, c.name, c.email
      ORDER BY weekly_periods DESC
    `;

    const facultyLoad = await query(sql, [user.branch]);

    return apiResponse({ data: facultyLoad });
  } catch (error) {
    console.error('Faculty Load API Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

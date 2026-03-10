import { query } from '@/lib/db';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty' || !user.is_hod) {
      return apiError('Unauthorized', 401);
    }

    // 1. Get the current academic year
    const semRows = await query('SELECT academic_year FROM semesters ORDER BY id DESC LIMIT 1');
    const currentYear = semRows[0]?.academic_year || '2025-26';

    // 2. Get ALL active faculty in the college
    // We join with the timetable to calculate their TOTAL workload across all departments
    const sql = `
      SELECT 
        c.id, 
        c.name, 
        c.email,
        c.branch as home_branch,
        COUNT(bt.id) as weekly_periods,
        (COUNT(bt.id) * 50) / 60 as weekly_hours
      FROM clerks c
      LEFT JOIN branch_timetable bt ON c.id = bt.faculty_id 
        AND bt.academic_year = ?
      WHERE c.role = 'faculty' AND c.is_active = 1
      GROUP BY c.id, c.name, c.email, c.branch
      ORDER BY c.name ASC
    `;

    const allFaculty = await query(sql, [currentYear]);

    return apiResponse({ data: allFaculty });
  } catch (error) {
    console.error('Faculty Load API Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

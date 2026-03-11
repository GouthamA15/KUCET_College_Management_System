import { query } from '@/lib/db';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty' || !user.is_hod) {
      return apiError('Unauthorized', 401);
    }

    const config = await query(
      'SELECT * FROM branch_config WHERE branch = ? ORDER BY id DESC LIMIT 1',
      [user.branch]
    );

    return apiResponse({ data: config[0] || { branch: user.branch, mid_max: 20, assignment_max: 10 } });
  } catch (error) {
    console.error('HOD Config API Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function PATCH(req) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty' || !user.is_hod) {
      return apiError('Unauthorized', 401);
    }

    const { mid_max, assignment_max, academic_year, semester } = await req.json();

    await query(
      `INSERT INTO branch_config (branch, academic_year, semester, mid_max, assignment_max)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE mid_max = VALUES(mid_max), assignment_max = VALUES(assignment_max)`,
      [user.branch, academic_year, semester, mid_max, assignment_max]
    );

    return apiResponse({ message: 'Configuration updated successfully' });
  } catch (error) {
    console.error('HOD Config Update Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

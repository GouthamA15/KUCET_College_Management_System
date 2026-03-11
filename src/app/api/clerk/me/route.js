import { query } from '@/lib/db';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  const user = await getAuthUser('clerk');

  if (!user) {
    return apiError('Unauthorized', 401);
  }

  try {
    // Fetch clerk basic info
    const rows = await query('SELECT id, name, email, role, employee_id, is_hod, branch FROM clerks WHERE id = ?', [user.clerkId]);
    if (rows.length === 0) {
      return apiError('Clerk not found', 404);
    }
    const clerk = rows[0];

    // Fetch system-wide academic year
    const semRows = await query('SELECT academic_year FROM semesters ORDER BY id DESC LIMIT 1');
    clerk.academic_year = semRows[0]?.academic_year || '2025-26';

    return apiResponse({ data: clerk });
  } catch (error) {
    console.error('Database error:', error);
    return apiError('Internal Server Error', 500);
  }
}

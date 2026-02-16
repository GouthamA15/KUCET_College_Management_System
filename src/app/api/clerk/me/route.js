import { query } from '@/lib/db';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  const user = await getAuthUser('clerk');

  if (!user) {
    return apiError('Unauthorized', 401);
  }

  try {
    const rows = await query('SELECT id, name, email, role, employee_id FROM clerks WHERE id = ?', [user.clerkId]);
    if (rows.length === 0) {
      return apiError('Clerk not found', 404);
    }
    const clerk = rows[0];
    return apiResponse(clerk);
  } catch (error) {
    console.error('Database error:', error);
    return apiError('Internal Server Error', 500);
  }
}

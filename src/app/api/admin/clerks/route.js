import { query } from '@/lib/db';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function GET() {
  const user = await getAuthUser('admin');

  if (!user) {
    return apiError('Unauthorized', 401);
  }

  try {
    const clerks = await query('SELECT id, name, email, employee_id, role, is_hod, branch, is_active, created_at, updated_at FROM clerks');
    return apiResponse({ data: clerks });
  } catch (error) {
    console.error('Error fetching clerks:', error);
    return apiError('Internal Server Error', 500);
  }
}
import logger from '@/lib/logger';
import { db } from '@/db';
import { clerks } from '@/db/schema';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function GET() {
  const user = await getAuthUser('admin');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const data = await db.select({
      id: clerks.id,
      name: clerks.name,
      email: clerks.email,
      employee_id: clerks.employee_id,
      role: clerks.role,
      is_hod: clerks.is_hod,
      branch: clerks.branch,
      is_active: clerks.is_active,
      created_at: clerks.created_at,
      updated_at: clerks.updated_at
    }).from(clerks);

    return apiResponse({ data });
  } catch (error) {
    logger.error('Error fetching clerks:', error);
    return apiError('Internal Server Error', 500);
  }
}

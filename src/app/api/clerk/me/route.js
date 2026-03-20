import logger from '@/lib/logger';
import { db } from '@/db';
import { clerks, semesters } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  const user = await getAuthUser('clerk');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const rows = await db.select({
      id: clerks.id,
      name: clerks.name,
      email: clerks.email,
      role: clerks.role,
      employee_id: clerks.employee_id,
      is_hod: clerks.is_hod,
      branch: clerks.branch
    })
    .from(clerks)
    .where(eq(clerks.id, user.clerkId))
    .limit(1);

    if (rows.length === 0) return apiError('Clerk not found', 404);
    const clerk = rows[0];

    const semRows = await db.select({ academic_year: semesters.academic_year })
      .from(semesters)
      .orderBy(desc(semesters.id))
      .limit(1);
    
    clerk.academic_year = semRows[0]?.academic_year || '2025-26';

    return apiResponse({ data: clerk });
  } catch (error) {
    logger.error('Database error:', error);
    return apiError('Internal Server Error', 500);
  }
}

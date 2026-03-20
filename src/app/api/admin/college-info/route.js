import logger from '@/lib/logger';
import { db } from '@/db';
import { collegeInfo as collegeInfoTable } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET() {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized', 401);

    const rows = await db.select({
      first_sem_start_month: collegeInfoTable.first_sem_start_month,
      first_sem_start_day: collegeInfoTable.first_sem_start_day,
      second_sem_start_month: collegeInfoTable.second_sem_start_month,
      second_sem_start_day: collegeInfoTable.second_sem_start_day
    })
    .from(collegeInfoTable)
    .where(eq(collegeInfoTable.id, 1))
    .limit(1);

    if (rows.length === 0) return apiResponse({ collegeInfo: {} });
    return apiResponse({ collegeInfo: rows[0] });
  } catch (error) {
    logger.error('Error fetching college info:', error);
    return apiError('Server error', 500);
  }
}

export async function PUT(req) {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized', 401);

    const body = await req.json();
    const { first_sem_start_month, first_sem_start_day, second_sem_start_month, second_sem_start_day } = body;

    const validateDatePart = (part, name) => {
      if (part !== null && part !== undefined && (typeof part !== 'number' || part < 1 || (name.includes('month') ? part > 12 : part > 31))) {
        return `${name} must be a number between 1 and ${name.includes('month') ? 12 : 31}, or null.`;
      }
      return null;
    };

    let error = validateDatePart(first_sem_start_month, 'first_sem_start_month');
    if (error) return apiError(error, 400);
    error = validateDatePart(first_sem_start_day, 'first_sem_start_day');
    if (error) return apiError(error, 400);
    error = validateDatePart(second_sem_start_month, 'second_sem_start_month');
    if (error) return apiError(error, 400);
    error = validateDatePart(second_sem_start_day, 'second_sem_start_day');
    if (error) return apiError(error, 400);

    await db.insert(collegeInfoTable).values({
      id: 1,
      first_sem_start_month,
      first_sem_start_day,
      second_sem_start_month,
      second_sem_start_day
    })
    .onDuplicateKeyUpdate({
      set: {
        first_sem_start_month: sql`VALUES(first_sem_start_month)`,
        first_sem_start_day: sql`VALUES(first_sem_start_day)`,
        second_sem_start_month: sql`VALUES(second_sem_start_month)`,
        second_sem_start_day: sql`VALUES(second_sem_start_day)`
      }
    });

    return apiResponse({ message: 'College information updated successfully' });
  } catch (error) {
    logger.error('Error updating college info:', error);
    return apiError('Server error', 500);
  }
}

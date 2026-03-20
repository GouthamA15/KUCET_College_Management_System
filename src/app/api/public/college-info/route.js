import { db } from '@/db';
import { collegeInfo } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiResponse, apiError } from '@/lib/api-utils';

export async function GET() {
  try {
    const row = await db.query.collegeInfo.findFirst({
      where: eq(collegeInfo.id, 1),
      columns: {
        first_sem_start_month: true,
        first_sem_start_day: true,
        second_sem_start_month: true,
        second_sem_start_day: true
      }
    });

    if (!row) {
      // If no record exists, return default/empty values
      return apiResponse({ collegeInfo: {} });
    }

    return apiResponse({ collegeInfo: row });
  } catch (error) {
    console.error('Error fetching public college info:', error);
    return apiError('Server error', 500);
  }
}

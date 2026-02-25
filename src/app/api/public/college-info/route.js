// src/app/api/public/college-info/route.js
import { query } from '@/lib/db';
import { apiResponse, apiError } from '@/lib/api-utils';

export async function GET() {
  try {
    const rows = await query(
      `SELECT first_sem_start_month, first_sem_start_day, second_sem_start_month, second_sem_start_day
       FROM college_info
       WHERE id = 1`
    );

    if (rows.length === 0) {
      // If no record exists, return default/empty values
      return apiResponse({ collegeInfo: {} });
    }

    return apiResponse({ collegeInfo: rows[0] });
  } catch (error) {
    console.error('Error fetching public college info:', error);
    return apiError('Server error', 500);
  }
}

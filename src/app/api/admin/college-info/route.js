import { query } from '@/lib/db';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET() {
  try {
    const user = await getAuthUser('admin');
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const rows = await query(
      `SELECT first_sem_start_month, first_sem_start_day, second_sem_start_month, second_sem_start_day
       FROM college_info
       WHERE id = 1`
    );

    if (rows.length === 0) {
      return apiResponse({ collegeInfo: {} });
    }

    return apiResponse({ collegeInfo: rows[0] });
  } catch (error) {
    console.error('Error fetching college info:', error);
    return apiError('Server error', 500);
  }
}

export async function PUT(req) {
  try {
    const user = await getAuthUser('admin');
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { first_sem_start_month, first_sem_start_day, second_sem_start_month, second_sem_start_day } = await req.json();

    const validateDatePart = (part, name) => {
      if (part !== null && (typeof part !== 'number' || part < 1 || (name.includes('month') ? part > 12 : part > 31))) {
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


    const existing = await query(`SELECT id FROM college_info WHERE id = 1`);
    if (existing.length === 0) {
      await query(
        `INSERT INTO college_info (id, first_sem_start_month, first_sem_start_day, second_sem_start_month, second_sem_start_day)
         VALUES (?, ?, ?, ?, ?)`,
        [1, first_sem_start_month, first_sem_start_day, second_sem_start_month, second_sem_start_day]
      );
    } else {
      await query(
        `UPDATE college_info
         SET first_sem_start_month = ?, first_sem_start_day = ?, second_sem_start_month = ?, second_sem_start_day = ?
         WHERE id = 1`,
        [first_sem_start_month, first_sem_start_day, second_sem_start_month, second_sem_start_day]
      );
    }

    return apiResponse({ message: 'College information updated successfully' });
  } catch (error) {
    console.error('Error updating college info:', error);
    return apiError('Server error', 500);
  }
}
import { query } from '@/lib/db';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  const user = await getAuthUser('clerk');

  if (!user) {
    return apiError('Unauthorized', 401);
  }

  try {
    const url = req.nextUrl;
    const name = url.searchParams.get('name');
    const admission_no = url.searchParams.get('admission_no');
    const roll_no = url.searchParams.get('roll_no');

    if (!name && !admission_no && !roll_no) {
      return apiError('Provide name or admission_no or roll_no', 400);
    }

    let sql = 'SELECT * FROM students WHERE ';
    const params = [];

    if (roll_no) {
      sql += 'roll_no = ?';
      params.push(roll_no);
    } else if (admission_no) {
      sql += 'admission_no = ?';
      params.push(admission_no);
    } else {
      // name search (case-insensitive)
      sql += 'name LIKE ?';
      params.push(`%${name}%`);
    }

    sql += ' LIMIT 100';

    const rows = await query(sql, params);
    return apiResponse({ students: rows });
  } catch (err) {
    console.error('Search students error:', err);
    return apiError('Server error', 500, err.message);
  }
}
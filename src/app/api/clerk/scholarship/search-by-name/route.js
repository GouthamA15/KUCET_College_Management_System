import { query } from '@/lib/db';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  const user = await getAuthUser('clerk');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const url = req.nextUrl;
    const nameRaw = url.searchParams.get('name') || '';
    const name = String(nameRaw).trim();

    if (!name || name.length < 2) {
      return apiError('Name must be at least 2 characters', 400);
    }

    const sql = `
      SELECT
        id,
        roll_no AS roll_number,
        name,
        admission_no
      FROM students
      WHERE name LIKE CONCAT('%', ?, '%')
        AND student_status = 'ACTIVE'
      LIMIT 10
    `;

    const rows = await query(sql, [name]);
    return apiResponse({ students: rows || [] });
  } catch (error) {
    console.error('Error searching scholarship students by name:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function POST() { return apiError('Method Not Allowed', 405); }
export async function PUT() { return apiError('Method Not Allowed', 405); }
export async function DELETE() { return apiError('Method Not Allowed', 405); }

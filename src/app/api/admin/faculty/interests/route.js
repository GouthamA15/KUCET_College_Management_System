import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { getDb } from '@/lib/db';
import { getNow } from '@/lib/clock';

export async function GET(request) {
  try {
    const user = await getAuthUser('admin');
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const db = getDb();
    
    // Get current academic year and semester type
    const now = await getNow();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    let academicYear = '';
    let isOddSem = true; // Odd (1,3,5,7) if roughly July-Dec, Even (2,4,6,8) if Jan-June

    if (currentMonth >= 6) {
      academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
      isOddSem = true;
    } else {
      academicYear = `${currentYear - 1}-${currentYear.toString().slice(-2)}`;
      isOddSem = false;
    }

    const [interests] = await db.execute(`
      SELECT fsi.*, c.name as faculty_name, c.employee_id
      FROM faculty_subject_interests fsi
      JOIN clerks c ON fsi.faculty_id = c.id
      WHERE fsi.academic_year = ? AND (fsi.semester % 2 != ?)
      ORDER BY fsi.created_at DESC
    `, [academicYear, isOddSem ? 0 : 1]);

    return apiResponse({ data: interests });
  } catch (error) {
    console.error('Admin Interests Fetch Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

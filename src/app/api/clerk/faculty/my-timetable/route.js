import { query } from '@/lib/db';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty') {
      return apiError('Unauthorized', 401);
    }

    // 1. Resolve system year
    const semRows = await query('SELECT academic_year FROM semesters ORDER BY id DESC LIMIT 1');
    const systemYear = semRows[0]?.academic_year || '2025-26';

    // 2. Fetch with lenient year matching
    const sql = `
      SELECT 
        bt.day_of_week,
        bt.period_number,
        bt.branch,
        bt.semester,
        bt.section,
        bt.room_no,
        s.subject_name,
        s.subject_code
      FROM branch_timetable bt
      LEFT JOIN syllabus_subjects s ON bt.subject_code = s.subject_code
      WHERE bt.faculty_id = ? 
      AND (bt.academic_year LIKE ? OR bt.academic_year = '2025-26')
      ORDER BY FIELD(bt.day_of_week, 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'), bt.period_number
    `;

    const mySchedule = await query(sql, [user.id, `%${systemYear.substring(0, 4)}%`]);

    return apiResponse({ data: mySchedule });
  } catch (error) {
    console.error('Faculty My-Timetable API Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

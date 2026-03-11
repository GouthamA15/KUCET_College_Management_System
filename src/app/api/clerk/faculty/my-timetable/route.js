import { query } from '@/lib/db';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty') {
      return apiError('Unauthorized', 401);
    }

    const clerkId = user.id || user.clerkId;
    if (!clerkId) return apiError('Faculty ID missing.', 400);

    const semRows = await query('SELECT academic_year FROM semesters ORDER BY id DESC LIMIT 1');
    const systemYear = semRows[0]?.academic_year || '2025-26';

    const sql = `
      SELECT 
        bt.day_of_week,
        bt.period_number,
        bt.branch,
        bt.semester,
        bt.room_no,
        COALESCE(s.subject_name, bt.subject_code) as display_name,
        bt.subject_code
      FROM branch_timetable bt
      LEFT JOIN syllabus_subjects s ON bt.subject_code = s.subject_code
      WHERE bt.faculty_id = ? 
      AND (bt.academic_year LIKE ? OR bt.academic_year = '2025-26')
      ORDER BY FIELD(bt.day_of_week, 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'), bt.period_number
    `;

    const mySchedule = await query(sql, [clerkId, `%${systemYear.substring(0, 4)}%`]);

    return apiResponse({ data: mySchedule });
  } catch (error) {
    console.error('Faculty My-Timetable API Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

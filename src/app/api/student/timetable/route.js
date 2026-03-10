import { query } from '@/lib/db';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { getCurrentSemester, getBranchFromRoll } from '@/lib/rollNumber';

export async function GET(req) {
  try {
    const user = await getAuthUser('student');
    if (!user) return apiError('Unauthorized', 401);

    const rollNo = user.roll_no || user.rollNo;
    if (!rollNo) return apiError('Roll number missing from session.', 400);

    const collegeInfoRows = await query('SELECT * FROM college_info LIMIT 1');
    const collegeInfo = collegeInfoRows[0] || null;

    const semester = getCurrentSemester(rollNo, collegeInfo);
    const branch = getBranchFromRoll(rollNo);

    if (!semester || !branch) return apiError('Resolution failed', 400);

    const semRows = await query('SELECT academic_year FROM semesters ORDER BY id DESC LIMIT 1');
    const systemYear = semRows[0]?.academic_year || '2025-26';

    const sql = `
      SELECT 
        bt.day_of_week,
        bt.period_number,
        bt.room_no,
        COALESCE(s.subject_name, bt.subject_code) as display_name,
        bt.subject_code,
        c.name as faculty_name
      FROM branch_timetable bt
      LEFT JOIN syllabus_subjects s ON bt.subject_code = s.subject_code
      LEFT JOIN clerks c ON bt.faculty_id = c.id
      WHERE bt.branch = ? AND bt.semester = ?
      AND (bt.academic_year LIKE ? OR bt.academic_year = '2025-26')
      ORDER BY FIELD(bt.day_of_week, 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'), bt.period_number
    `;

    const timetable = await query(sql, [branch, semester, `%${systemYear.substring(0, 4)}%`]);

    return apiResponse({ data: timetable, meta: { branch, semester, systemYear, rollNo } });
  } catch (error) {
    console.error('Student Timetable API Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

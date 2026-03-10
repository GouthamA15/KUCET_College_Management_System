import { query } from '@/lib/db';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { getNow } from '@/lib/clock';
import { getCurrentSemester, getBranchFromRoll } from '@/lib/rollNumber';

export async function GET(req) {
  try {
    const user = await getAuthUser('student');
    if (!user) return apiError('Unauthorized', 401);

    const rollNo = user.roll_no || user.rollNo;
    if (!rollNo) return apiError('Roll number missing.', 400);

    const now = await getNow();
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const day = days[now.getDay()];
    const time = now.getHours() * 100 + now.getMinutes();

    // Map time to period
    let period = null;
    if (time >= 930 && time < 1020) period = 1;
    else if (time >= 1020 && time < 1110) period = 2;
    else if (time >= 1120 && time < 1210) period = 3;
    else if (time >= 1210 && time < 1300) period = 4;
    else if (time >= 1400 && time < 1450) period = 5;
    else if (time >= 1450 && time < 1540) period = 6;
    else if (time >= 1540 && time < 1630) period = 7;

    if (!period || day === 'SUN') {
      return apiResponse({ active: false, message: 'Outside college hours' });
    }

    // Resolve context
    const collegeInfoRows = await query('SELECT * FROM college_info LIMIT 1');
    const collegeInfo = collegeInfoRows[0] || null;
    const semester = getCurrentSemester(rollNo, collegeInfo);
    const branch = getBranchFromRoll(rollNo);

    if (!semester || !branch) {
      return apiResponse({ active: false, message: 'Context resolution failed' });
    }

    const semRows = await query('SELECT academic_year FROM semesters ORDER BY id DESC LIMIT 1');
    const systemYear = semRows[0]?.academic_year || '2025-26';

    const sql = `
      SELECT 
        bt.room_no,
        COALESCE(s.subject_name, bt.subject_code) as subject_name,
        c.name as faculty_name,
        bt.subject_code
      FROM branch_timetable bt
      LEFT JOIN syllabus_subjects s ON bt.subject_code = s.subject_code
      LEFT JOIN clerks c ON bt.faculty_id = c.id
      WHERE bt.branch = ? AND bt.semester = ? AND bt.day_of_week = ? AND bt.period_number = ?
      AND (bt.academic_year LIKE ? OR bt.academic_year = '2025-26')
      LIMIT 1
    `;

    const rows = await query(sql, [branch, semester, day, period, `%${systemYear.substring(0, 4)}%`]);

    if (rows.length === 0) {
      return apiResponse({ active: false, message: 'No lecture scheduled' });
    }

    return apiResponse({ 
      active: true, 
      period,
      activity: rows[0] 
    });
  } catch (error) {
    console.error('Student Current Activity API Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

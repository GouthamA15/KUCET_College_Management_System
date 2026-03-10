import { query } from '@/lib/db';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { getCurrentStudyingYear, getCurrentSemester } from '@/lib/rollNumber';

export async function GET(req) {
  try {
    const user = await getAuthUser('student');
    if (!user) return apiError('Unauthorized', 401);

    // 1. Resolve student's current academic context
    const currentYear = getCurrentStudyingYear(user.rollNo);
    const semester = getCurrentSemester(user.rollNo);
    
    // 2. Resolve section (default to A if not in DB, though ideally student table has it)
    // For now we fetch for Section A as per your institutional baseline
    const section = 'A';

    // 3. Fetch the branch name for this student
    const studentRows = await query('SELECT branch FROM student_admission_drafts WHERE email = ?', [user.email]);
    // Fallback: If not in drafts, parse from roll no (handled by lib/rollNumber usually)
    let branch = studentRows[0]?.branch || 'CSE'; 

    // 4. Fetch the timetable
    const sql = `
      SELECT 
        bt.day_of_week,
        bt.period_number,
        bt.room_no,
        s.subject_name,
        s.subject_code,
        c.name as faculty_name
      FROM branch_timetable bt
      LEFT JOIN syllabus_subjects s ON bt.subject_code = s.subject_code
      LEFT JOIN clerks c ON bt.faculty_id = c.id
      WHERE bt.branch = ? AND bt.semester = ? AND bt.section = ?
      ORDER BY FIELD(bt.day_of_week, 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'), bt.period_number
    `;

    const timetable = await query(sql, [branch, semester, section]);

    return apiResponse({ 
      data: timetable,
      meta: { branch, semester, section }
    });
  } catch (error) {
    console.error('Student Timetable API Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

import { query } from '@/lib/db';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty' || !user.is_hod) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(req.url);
    const semester = searchParams.get('semester') || 1;
    const section = searchParams.get('section') || 'A';

    // Fetch system-wide academic year
    const semRows = await query('SELECT academic_year FROM semesters ORDER BY id DESC LIMIT 1');
    const systemYear = semRows[0]?.academic_year || '2025-26';
    
    const timetable = await query(
      `SELECT bt.*, c.name as faculty_name, s.subject_name 
       FROM branch_timetable bt
       LEFT JOIN clerks c ON bt.faculty_id = c.id
       LEFT JOIN syllabus_subjects s ON bt.subject_code = s.subject_code
       WHERE bt.branch = ? AND bt.semester = ? AND bt.section = ?
       AND (bt.academic_year LIKE ? OR bt.academic_year = '2025-26')
       ORDER BY day_of_week, period_number`,
      [user.branch, semester, section, `%${systemYear.substring(0, 4)}%`]
    );

    return apiResponse({ data: timetable });
  } catch (error) {
    console.error('Timetable API Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function POST(req) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty' || !user.is_hod) {
      return apiError('Unauthorized', 401);
    }

    let { 
      semester, section, day_of_week, period_number, 
      subject_code, faculty_id, academic_year, room_no 
    } = await req.json();

    // Sanitize faculty_id: Convert empty string to null for DB integer column
    const sanitizedFacultyId = (faculty_id === '' || !faculty_id) ? null : parseInt(faculty_id);

    // Timetable Conflict Validation (Faculty overlap)
    if (sanitizedFacultyId) {
      const conflict = await query(
        `SELECT * FROM branch_timetable 
         WHERE faculty_id = ? AND day_of_week = ? 
         AND period_number = ? AND academic_year = ? 
         AND NOT (branch = ? AND semester = ? AND section = ?)`,
        [sanitizedFacultyId, day_of_week, period_number, academic_year, user.branch, semester, section]
      );

      if (conflict && conflict.length > 0) {
        return apiError(`Faculty conflict: This faculty is already assigned to ${conflict[0].branch} Sem ${conflict[0].semester} Sec ${conflict[0].section} at this time.`, 400);
      }
    }

    await query(
      `INSERT INTO branch_timetable 
       (branch, semester, section, day_of_week, period_number, subject_code, faculty_id, academic_year, room_no)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
       subject_code = VALUES(subject_code), 
       faculty_id = VALUES(faculty_id), 
       room_no = VALUES(room_no)`,
      [user.branch, semester, section, day_of_week, period_number, subject_code, sanitizedFacultyId, academic_year, room_no]
    );

    return apiResponse({ success: true, message: 'Slot updated successfully' });
  } catch (error) {
    console.error('Timetable Save Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

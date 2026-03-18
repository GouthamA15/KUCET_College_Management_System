import { query } from '@/lib/db';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { broadcastUpdate } from '@/lib/sse';

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
      semester, section = 'A', day_of_week, period_number, 
      subject_code, faculty_id, academic_year = '2025-26', room_no = null 
    } = await req.json();

    // Sanitize faculty_id: Convert empty string to null for DB integer column
    const sanitizedFacultyId = (faculty_id === '' || !faculty_id) ? null : parseInt(faculty_id);

    // Timetable Conflict Validation (Faculty overlap)
    if (sanitizedFacultyId) {
      // Use fuzzy year matching to catch conflicts across variations (e.g. "2025-26" vs "2025-26 (Even)")
      const yearPrefix = academic_year.substring(0, 7); // e.g., "2025-26"
      
      const conflict = await query(
        `SELECT bt.*, s.subject_name 
         FROM branch_timetable bt
         LEFT JOIN syllabus_subjects s ON bt.subject_code = s.subject_code
         WHERE bt.faculty_id = ? AND bt.day_of_week = ? 
         AND bt.period_number = ? 
         AND (bt.academic_year LIKE ? OR bt.academic_year = ?)
         AND NOT (bt.branch = ? AND bt.semester = ? AND bt.section = ?)`,
        [sanitizedFacultyId, day_of_week, period_number, `%${yearPrefix}%`, academic_year, user.branch, semester, section]
      );

      if (conflict && conflict.length > 0) {
        const c = conflict[0];
        return apiError(`Faculty Conflict: This instructor is already assigned to ${c.subject_name || c.subject_code} in ${c.branch} Sem ${c.semester} (Sec ${c.section}) during this period.`, 400);
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

    // REAL-TIME: Broadcast change
    broadcastUpdate('TIMETABLE_CHANGED', { branch: user.branch, semester });

    return apiResponse({ success: true, message: 'Slot updated successfully' });
  } catch (error) {
    console.error('Timetable Save Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function DELETE(req) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty' || !user.is_hod) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(req.url);
    const semester = searchParams.get('semester');
    const section = searchParams.get('section') || 'A';
    const day_of_week = searchParams.get('day_of_week');
    const period_number = searchParams.get('period_number');

    if (!semester || !day_of_week || !period_number) {
      return apiError('Missing required parameters', 400);
    }

    await query(
      `DELETE FROM branch_timetable 
       WHERE branch = ? AND semester = ? AND section = ? AND day_of_week = ? AND period_number = ?`,
      [user.branch, semester, section, day_of_week, period_number]
    );

    // REAL-TIME: Broadcast change
    broadcastUpdate('TIMETABLE_CHANGED', { branch: user.branch, semester });

    return apiResponse({ success: true, message: 'Lecture deleted successfully' });
  } catch (error) {
    console.error('Timetable Delete Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

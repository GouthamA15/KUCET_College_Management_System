import { query } from '@/lib/db';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function GET(request) {
  try {
    const user = await getAuthUser('student');
    if (!user) return apiError('Unauthorized', 401);

    const studentRoll = user.roll_no;
    if (!studentRoll) return apiError('Student roll number not found in session', 400);

    // Resolve student id
    const students = await query('SELECT id FROM students WHERE roll_no = ?', [studentRoll]);
    if (!students || students.length === 0) return apiResponse({ scholarshipThumbUpdate: { active: false } });
    const studentId = students[0].id;

    const rows = await query("SELECT application_no, academic_year FROM scholarship_sanctions WHERE student_id = ? AND thumb_update_available = 1 AND LOWER(COALESCE(thumb_status, '')) = 'pending' LIMIT 1", [studentId]);
    if (!rows || rows.length === 0) {
      return apiResponse({ scholarshipThumbUpdate: { active: false } });
    }

    const r = rows[0];
    return apiResponse({ scholarshipThumbUpdate: { active: true, application_no: r.application_no || null, academic_year: r.academic_year || null } });
  } catch (error) {
    console.error('Failed to fetch student activity', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function POST() { return apiError('Method Not Allowed', 405); }
export async function PUT() { return apiError('Method Not Allowed', 405); }
export async function DELETE() { return apiError('Method Not Allowed', 405); }

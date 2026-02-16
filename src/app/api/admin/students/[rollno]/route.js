import { query } from '@/lib/db';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function GET(request, { params }) {
  const user = await getAuthUser('admin');

  if (!user) {
    return apiError('Unauthorized', 401);
  }

  const { rollno } = await params;

  if (!rollno) {
    return apiError('Roll number is required', 400);
  }

  try {
    const studentQuery = `
      SELECT s.*, CASE WHEN si.pfp IS NOT NULL THEN 1 ELSE 0 END as has_pfp 
      FROM students s 
      LEFT JOIN student_images si ON s.id = si.student_id 
      WHERE s.roll_no = ?`;
    const [student] = await query(studentQuery, [rollno]);

    if (!student) {
      return apiError('Student not found', 404);
    }

    if (student.has_pfp) {
        student.pfp = `/api/student/image/${student.roll_no}`;
    } else {
        student.pfp = null;
    }
    delete student.has_pfp;

    return apiResponse({ student });
  } catch (error) {
    console.error('Failed to fetch student:', error);
    return apiError('Failed to fetch student', 500);
  }
}
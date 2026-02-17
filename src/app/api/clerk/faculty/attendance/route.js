import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { getDb } from '@/lib/db';
import { isSemesterActive } from '@/lib/academic-utils';

export async function POST(request) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty') {
      return apiError('Unauthorized', 401);
    }

    const body = await request.json();
    const { assignment_id, date, attendance_data } = body;

    if (!assignment_id || !date || !Array.isArray(attendance_data)) {
      return apiError('Missing required fields', 400);
    }

    const db = getDb();
    // Verify assignment belongs to faculty and get details for activity check
    const [assignments] = await db.execute(
      'SELECT * FROM faculty_subject_assignments WHERE id = ? AND faculty_id = ?',
      [assignment_id, user.id]
    );

    if (assignments.length === 0) {
      return apiError('Assignment not found or unauthorized', 404);
    }

    const assignment = assignments[0];

    // Check if assignment is active
    const [collegeInfoRows] = await db.execute('SELECT * FROM college_info WHERE id = 1');
    const collegeInfo = collegeInfoRows[0] || null;

    if (!isSemesterActive(assignment.semester, assignment.academic_year, collegeInfo)) {
      return apiError('Semester has ended. Attendance can no longer be modified.', 403);
    }

    // Begin Transaction
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      for (const item of attendance_data) {
        const { student_id, status } = item;
        
        // Insert or Update attendance
        await connection.execute(`
          INSERT INTO student_attendance (student_id, assignment_id, date, status)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE status = VALUES(status)
        `, [student_id, assignment_id, date, status]);
      }

      await connection.commit();
      return apiResponse({ message: 'Attendance updated successfully' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Attendance Update Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function DELETE(request) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty') {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const assignment_id = searchParams.get('assignment_id');
    const date = searchParams.get('date');

    if (!assignment_id || !date) {
      return apiError('Missing required parameters', 400);
    }

    const db = getDb();
    // Verify assignment and activity
    const [assignments] = await db.execute(
      'SELECT * FROM faculty_subject_assignments WHERE id = ? AND faculty_id = ?',
      [assignment_id, user.id]
    );

    if (assignments.length === 0) {
      return apiError('Assignment not found or unauthorized', 404);
    }

    const assignment = assignments[0];
    const [collegeInfoRows] = await db.execute('SELECT * FROM college_info WHERE id = 1');
    const collegeInfo = collegeInfoRows[0] || null;

    if (!isSemesterActive(assignment.semester, assignment.academic_year, collegeInfo)) {
      return apiError('Semester has ended. Attendance can no longer be modified.', 403);
    }

    await db.execute(
      'DELETE FROM student_attendance WHERE assignment_id = ? AND date = ?',
      [assignment_id, date]
    );

    return apiResponse({ message: 'Attendance for the selected date has been deleted' });
  } catch (error) {
    console.error('Attendance Delete Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

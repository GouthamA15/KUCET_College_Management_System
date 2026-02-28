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
    const { assignment_id, date, session, attendance_data } = body;

    if (!assignment_id || !date || !session || !Array.isArray(attendance_data)) {
      return apiError('Missing required fields', 400);
    }

    // Validate each attendance record: status must not be null/undefined
    for (const item of attendance_data) {
      if (item == null || item.student_id == null) {
        return apiError('Missing attendance item or student_id', 400);
      }
      if (item.status === null || item.status === undefined) {
        return apiError('Status cannot be null', 400);
      }
    }

    const db = getDb();
    // Verify assignment belongs to faculty
    const [assignments] = await db.execute(
      'SELECT id, subject_code, branch, course_semester, academic_year FROM faculty_subject_assignments WHERE id = ? AND faculty_id = ?',
      [assignment_id, user.id]
    );

    if (assignments.length === 0) {
      return apiError('Assignment not found or unauthorized', 404);
    }

    const assignment = assignments[0];
    const { subject_code, branch, course_semester, academic_year } = assignment;

    // --- SHARED DATA LOGIC: Canonical ID ---
    // All faculty teaching the same subject share the same attendance table records
    const [canonicalRows] = await db.execute(`
      SELECT id FROM faculty_subject_assignments 
      WHERE subject_code = ? AND branch = ? AND course_semester = ? AND academic_year = ?
      ORDER BY created_at ASC LIMIT 1
    `, [subject_code, branch, course_semester, academic_year]);
    
    const targetAssignmentId = canonicalRows[0]?.id || assignment_id;

    // Check if assignment is active
    const [collegeInfoRows] = await db.execute('SELECT * FROM college_info WHERE id = 1');
    const collegeInfo = collegeInfoRows[0] || null;

    if (!await isSemesterActive(course_semester, academic_year, collegeInfo)) {
      return apiError('Semester has ended. Attendance locked.', 403);
    }

    // Begin Transaction
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      if (attendance_data.length > 0) {
        // Build a single bulk insert query for high performance
        const values = [];
        const placeholders = attendance_data.map(item => {
          values.push(item.student_id, targetAssignmentId, date, session, item.status);
          return '(?, ?, ?, ?, ?)';
        }).join(', ');

        const sql = `
          INSERT INTO student_attendance (student_id, assignment_id, date, session, status)
          VALUES ${placeholders}
          ON DUPLICATE KEY UPDATE status = VALUES(status)
        `;
        
        await connection.execute(sql, values);
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
    const session = searchParams.get('session');

    if (!assignment_id || !date || !session) {
      return apiError('Missing required parameters', 400);
    }

    const db = getDb();
    // Verify assignment and activity
    const [assignments] = await db.execute(
      'SELECT id, subject_code, branch, course_semester, academic_year FROM faculty_subject_assignments WHERE id = ? AND faculty_id = ?',
      [assignment_id, user.id]
    );

    if (assignments.length === 0) {
      return apiError('Assignment not found or unauthorized', 404);
    }

    const assignment = assignments[0];
    const { subject_code, branch, course_semester, academic_year } = assignment;

    // --- SHARED DATA LOGIC: Canonical ID ---
    const [canonicalRows] = await db.execute(`
      SELECT id FROM faculty_subject_assignments 
      WHERE subject_code = ? AND branch = ? AND course_semester = ? AND academic_year = ?
      ORDER BY created_at ASC LIMIT 1
    `, [subject_code, branch, course_semester, academic_year]);
    
    const targetAssignmentId = canonicalRows[0]?.id || assignment_id;

    const [collegeInfoRows] = await db.execute('SELECT * FROM college_info WHERE id = 1');
    const collegeInfo = collegeInfoRows[0] || null;

    if (!await isSemesterActive(course_semester, academic_year, collegeInfo)) {
      return apiError('Semester has ended. Attendance locked.', 403);
    }

    await db.execute(
      'DELETE FROM student_attendance WHERE assignment_id = ? AND date = ? AND session = ?',
      [targetAssignmentId, date, session]
    );

    return apiResponse({ message: 'Attendance for the selected date has been deleted' });
  } catch (error) {
    console.error('Attendance Delete Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

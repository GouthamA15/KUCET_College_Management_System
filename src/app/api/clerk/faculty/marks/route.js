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
    const { assignment_id, marks_data } = body;

    if (!assignment_id || !Array.isArray(marks_data)) {
      return apiError('Missing required fields', 400);
    }

    const db = getDb();
    // Verify assignment belongs to faculty
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

    if (!await isSemesterActive(assignment.semester, assignment.academic_year, collegeInfo)) {
      return apiError('Semester has ended. Marks can no longer be modified.', 403);
    }

    // Begin Transaction
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      for (const item of marks_data) {
        const { student_id, mid1_marks, mid2_marks, assignment_marks } = item;
        
        // Insert or Update marks
        await connection.execute(`
          INSERT INTO student_marks (student_id, assignment_id, mid1_marks, mid2_marks, assignment_marks)
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE 
            mid1_marks = VALUES(mid1_marks),
            mid2_marks = VALUES(mid2_marks),
            assignment_marks = VALUES(assignment_marks)
        `, [student_id, assignment_id, mid1_marks, mid2_marks, assignment_marks]);
      }

      await connection.commit();
      return apiResponse({ message: 'Marks updated successfully' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Marks Update Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

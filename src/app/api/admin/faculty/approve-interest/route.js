import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { getDb } from '@/lib/db';

export async function POST(request) {
  try {
    const user = await getAuthUser('admin');
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const body = await request.json();
    const { interest_id, status } = body;

    if (!interest_id || !status) {
      return apiError('Missing required fields', 400);
    }

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return apiError('Invalid status', 400);
    }

    const db = getDb();
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Get interest details
      const [interests] = await connection.execute(
        'SELECT * FROM faculty_subject_interests WHERE id = ?',
        [interest_id]
      );

      if (interests.length === 0) {
        await connection.rollback();
        return apiError('Interest not found', 404);
      }

      const interest = interests[0];

      // Update interest status
      await connection.execute(
        'UPDATE faculty_subject_interests SET status = ? WHERE id = ?',
        [status, interest_id]
      );

      if (status === 'APPROVED') {
        // Create assignment
        const academicTerm = interest.semester % 2 === 0 ? 2 : 1;
        await connection.execute(
          'INSERT INTO faculty_subject_assignments (faculty_id, subject_code, subject_name, branch, course_semester, academic_term, academic_year) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            interest.faculty_id,
            interest.subject_code,
            interest.subject_name,
            interest.branch,
            interest.semester, // maps to course_semester
            academicTerm,
            interest.academic_year,
          ]
        );
      }

      await connection.commit();
      return apiResponse({ message: `Interest ${status.toLowerCase()} successfully` });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Approve Interest Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

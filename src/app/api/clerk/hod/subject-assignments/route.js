import { query } from '@/lib/db';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty' || !user.is_hod) {
      return apiError('Unauthorized', 401);
    }

    const sql = `
      SELECT 
        fsa.id,
        fsa.faculty_id,
        fsa.subject_code,
        fsa.subject_name,
        fsa.course_semester,
        c.name as faculty_name
      FROM faculty_subject_assignments fsa
      JOIN clerks c ON fsa.faculty_id = c.id
      WHERE fsa.branch = ? AND fsa.is_active = 1
      ORDER BY fsa.course_semester DESC, fsa.subject_name ASC
    `;

    const assignments = await query(sql, [user.branch]);
    return apiResponse({ data: assignments });
  } catch (error) {
    console.error('Subject Assignments GET Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function POST(req) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty' || !user.is_hod) {
      return apiError('Unauthorized', 401);
    }

    const { faculty_id, subject_code, subject_name, semester, academic_year } = await req.json();

    if (!faculty_id || !subject_code || !semester) {
      return apiError('Missing required fields', 400);
    }

    // Insert into official assignments table
    // We use a simplified version of the institutional table structure
    await query(
      `INSERT INTO faculty_subject_assignments 
       (faculty_id, subject_code, subject_name, branch, course_semester, academic_term, academic_year, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE faculty_id = VALUES(faculty_id), is_active = 1`,
      [
        faculty_id, 
        subject_code, 
        subject_name, 
        user.branch, 
        semester, 
        (semester % 2 === 0 ? 2 : 1), // Resolve term from semester
        academic_year || '2025-26'
      ]
    );

    return apiResponse({ success: true, message: 'Faculty assigned successfully' });
  } catch (error) {
    console.error('Subject Assignments POST Error:', error);
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
      const id = searchParams.get('id');
  
      await query('UPDATE faculty_subject_assignments SET is_active = 0 WHERE id = ? AND branch = ?', [id, user.branch]);
  
      return apiResponse({ success: true, message: 'Assignment revoked' });
    } catch (error) {
      console.error('Subject Assignments DELETE Error:', error);
      return apiError('Internal Server Error', 500);
    }
}

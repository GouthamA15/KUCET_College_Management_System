import { query } from '@/lib/db';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty' || !user.is_hod) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(req.url);
    const semester = searchParams.get('semester') || 6;

    // Resolve system year
    const semRows = await query('SELECT academic_year FROM semesters ORDER BY id DESC LIMIT 1');
    const systemYear = semRows[0]?.academic_year || '2025-26';

    /**
     * This query calculates:
     * 1. Total sessions conducted for each subject in this branch/sem
     * 2. Total sessions attended by each student
     * 3. Overall percentage across all subjects
     */
    const sql = `
      SELECT 
        s.roll_no,
        s.name,
        COUNT(sa.id) as total_present,
        (
          SELECT COUNT(*) 
          FROM student_attendance sa2 
          JOIN faculty_subject_assignments fsa2 ON sa2.assignment_id = fsa2.id
          WHERE sa2.student_id = s.id 
          AND fsa2.course_semester = ? 
          AND fsa2.branch = ?
        ) as total_sessions_recorded,
        ROUND((COUNT(CASE WHEN sa.status = 'PRESENT' THEN 1 END) / COUNT(sa.id)) * 100, 1) as percentage
      FROM students s
      JOIN student_attendance sa ON s.id = sa.student_id
      JOIN faculty_subject_assignments fsa ON sa.assignment_id = fsa.id
      WHERE fsa.branch = ? AND fsa.course_semester = ? 
      AND (fsa.academic_year LIKE ? OR fsa.academic_year = '2025-26')
      GROUP BY s.id, s.roll_no, s.name
      HAVING percentage < 75
      ORDER BY percentage ASC
    `;

    const risks = await query(sql, [
      semester, user.branch, user.branch, semester, `%${systemYear.substring(0, 4)}%`
    ]);

    return apiResponse({ 
      data: risks,
      threshold: 75,
      branch: user.branch,
      semester 
    });
  } catch (error) {
    console.error('Attendance Analytics API Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

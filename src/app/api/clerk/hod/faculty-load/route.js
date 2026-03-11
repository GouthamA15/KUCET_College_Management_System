import { query } from '@/lib/db';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty' || !user.is_hod) {
      return apiError('Unauthorized', 401);
    }

    // 1. Resolve current academic year
    const semRows = await query('SELECT academic_year FROM semesters ORDER BY id DESC LIMIT 1');
    const systemYear = semRows[0]?.academic_year || '2025-26';
    const yearPattern = `%${systemYear.substring(0, 4)}%`;

    // 2. Fetch Detailed Workload
    // Metrics: Scheduled (Timetable), Conducted (Sessions Marked), and Assignments
    const sql = `
      SELECT 
        c.id, 
        c.name, 
        c.email,
        c.branch as home_branch,
        -- Count scheduled periods per week from timetable
        (
          SELECT COUNT(*) 
          FROM branch_timetable bt 
          WHERE bt.faculty_id = c.id 
          AND (bt.academic_year LIKE ? OR bt.academic_year = '2025-26')
        ) as scheduled_weekly,
        -- Count total actual sessions marked attendance for this semester
        (
          SELECT COUNT(DISTINCT ads.id)
          FROM attendance_sessions ads
          JOIN faculty_subject_assignments fsa ON ads.assignment_id = fsa.id
          WHERE ads.faculty_id = c.id
          AND (fsa.academic_year LIKE ? OR fsa.academic_year = '2025-26')
        ) as total_conducted,
        -- Get comma-separated list of assigned subject names
        (
          SELECT GROUP_CONCAT(DISTINCT fsa.subject_name SEPARATOR ', ')
          FROM faculty_subject_assignments fsa
          WHERE fsa.faculty_id = c.id AND fsa.is_active = 1
          AND (fsa.academic_year LIKE ? OR fsa.academic_year = '2025-26')
        ) as subjects
      FROM clerks c
      WHERE c.role = 'faculty' 
      AND c.branch = ?
      AND c.is_active = 1
      ORDER BY scheduled_weekly DESC, c.name ASC
    `;

    const facultyLoad = await query(sql, [yearPattern, yearPattern, yearPattern, user.branch]);

    return apiResponse({ 
      data: facultyLoad,
      meta: { systemYear }
    });
  } catch (error) {
    console.error('Faculty Load API Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

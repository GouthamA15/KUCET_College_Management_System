import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { getDb } from '@/lib/db';
import { branchCodes } from '@/lib/rollNumber';

export async function GET(request) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty') {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const assignment_id = searchParams.get('assignment_id');

    if (!assignment_id) {
      return apiError('Assignment ID is required', 400);
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
    const [canonicalRows] = await db.execute(`
      SELECT id FROM faculty_subject_assignments 
      WHERE subject_code = ? AND branch = ? AND course_semester = ? AND academic_year = ?
      ORDER BY created_at ASC LIMIT 1
    `, [subject_code, branch, course_semester, academic_year]);
    
    const targetAssignmentId = canonicalRows[0]?.id || assignment_id;

    // Calculate Entry Year based on Semester and Academic Year
    const startYear = parseInt(academic_year.split('-')[0]);
    const studyingYear = Math.ceil(course_semester / 2);
    const entryYearRegular = (startYear - (studyingYear - 1)).toString().slice(-2);
    const entryYearLateral = (startYear - (studyingYear - 2)).toString().slice(-2);

    const branchCode = Object.keys(branchCodes).find(key => branchCodes[key] === branch);
    if (!branchCode) {
      return apiError('Invalid branch in assignment', 400);
    }

    const regularPattern = `${entryYearRegular}567T${branchCode}%`;
    const lateralPattern = `${entryYearLateral}567${branchCode}%L`;

    // Fetch students and their marks for this canonical subject instance
    let studentsQuery = `
      SELECT 
        s.id, 
        s.roll_no, 
        s.name,
        sm.mid1_marks,
        sm.mid2_marks,
        sm.assignment_marks
      FROM students s
      LEFT JOIN student_marks sm ON s.id = sm.student_id AND sm.assignment_id = ?
      WHERE (s.roll_no LIKE ?
    `;

    const params = [targetAssignmentId, regularPattern];
    if (studyingYear >= 2) {
      studentsQuery += ' OR s.roll_no LIKE ?';
      params.push(lateralPattern);
    }
    studentsQuery += ') ORDER BY s.roll_no ASC';

    const [students] = await db.execute(studentsQuery, params);

    return apiResponse({ data: students, sessions: [] });
  } catch (error) {
    console.error('Students Fetch Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

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
      'SELECT * FROM faculty_subject_assignments WHERE id = ? AND faculty_id = ?',
      [assignment_id, user.id]
    );

    if (assignments.length === 0) {
      return apiError('Assignment not found or unauthorized', 404);
    }

    const assignment = assignments[0];
    const { branch, semester, academic_year } = assignment;

    // Calculate Entry Year based on Semester and Academic Year
    // academic_year format "2024-25" -> start year 2024
    const startYear = parseInt(academic_year.split('-')[0]);
    const studyingYear = Math.ceil(semester / 2);
    
    // For Regular: EntryYear = startYear - (studyingYear - 1)
    // For Lateral: EntryYear = startYear - (studyingYear - 2) if studyingYear >= 2
    
    const entryYearRegular = (startYear - (studyingYear - 1)).toString().slice(-2);
    const entryYearLateral = (startYear - (studyingYear - 2)).toString().slice(-2);

    const branchCode = Object.keys(branchCodes).find(key => branchCodes[key] === branch);
    
    if (!branchCode) {
      return apiError('Invalid branch in assignment', 400);
    }

    // Pattern for regular: {entryYearRegular}567T{branchCode}XX
    // Pattern for lateral: {entryYearLateral}567{branchCode}XXL
    
    const regularPattern = `${entryYearRegular}567T${branchCode}%`;
    const lateralPattern = `${entryYearLateral}567${branchCode}%L`;

    // Fetch students matching the patterns
    // Also fetch attendance summary and marks for this assignment
    let studentsQuery = `
      SELECT 
        s.id, s.roll_no, s.name,
        curr_sa.status as attendance_status,
        sm.mid1_marks, sm.mid2_marks, sm.assignment_marks,
        (SELECT COUNT(*) FROM student_attendance WHERE student_id = s.id AND assignment_id = ?) as total_classes,
        (SELECT COUNT(*) FROM student_attendance WHERE student_id = s.id AND assignment_id = ? AND status = 'PRESENT') as attended_classes
      FROM students s
      LEFT JOIN student_attendance curr_sa ON s.id = curr_sa.student_id AND curr_sa.assignment_id = ? AND curr_sa.date = CURDATE()
      LEFT JOIN student_marks sm ON s.id = sm.student_id AND sm.assignment_id = ?
      WHERE (s.roll_no LIKE ?
    `;
    let queryParams = [assignment_id, assignment_id, assignment_id, assignment_id, regularPattern];

    if (studyingYear >= 2) {
      studentsQuery += ' OR s.roll_no LIKE ?';
      queryParams.push(lateralPattern);
    }
    
    studentsQuery += ') ORDER BY s.roll_no ASC';

    const [students] = await db.execute(studentsQuery, queryParams);

    return apiResponse({ data: students });
  } catch (error) {
    console.error('Students Fetch Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

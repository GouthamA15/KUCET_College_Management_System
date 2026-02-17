import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { getDb } from '@/lib/db';
import { calculateYearAndSemesterAsync, getCollegeAcademicYear } from '@/lib/academic-utils';
import { getBranchFromRoll } from '@/lib/rollNumber';

export async function GET(request) {
  try {
    const user = await getAuthUser('student');
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const db = getDb();
    const [collegeInfoRows] = await db.execute('SELECT * FROM college_info WHERE id = 1');
    const collegeInfo = collegeInfoRows[0] || null;

    const { semester } = await calculateYearAndSemesterAsync(user.roll_no, collegeInfo);
    const academicYear = await getCollegeAcademicYear(collegeInfo);
    const branch = getBranchFromRoll(user.roll_no);
    const studentId = user.student_id;

    if (!studentId || !branch || !semester || !academicYear) {
      return apiError('Unable to determine student academic context', 400);
    }

    // Fetch subjects assigned to this student's class (branch/sem/AY)
    // and join with student's own marks and attendance summary
    const [subjects] = await db.execute(`
      SELECT 
        fsa.id as assignment_id,
        fsa.subject_code,
        fsa.subject_name,
        c.name as faculty_name,
        sm.mid1_marks,
        sm.mid2_marks,
        sm.assignment_marks,
        (SELECT COUNT(*) FROM student_attendance WHERE student_id = ? AND assignment_id = fsa.id) as total_classes,
        (SELECT COUNT(*) FROM student_attendance WHERE student_id = ? AND assignment_id = fsa.id AND status = 'PRESENT') as attended_classes
      FROM faculty_subject_assignments fsa
      JOIN clerks c ON fsa.faculty_id = c.id
      LEFT JOIN student_marks sm ON sm.assignment_id = fsa.id AND sm.student_id = ?
      WHERE fsa.branch = ? AND fsa.semester = ? AND fsa.academic_year = ?
    `, [studentId, studentId, studentId, branch, semester, academicYear]);

    return apiResponse({ 
      data: subjects,
      semester,
      academicYear
    });
  } catch (error) {
    console.error('Student Academic Info Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

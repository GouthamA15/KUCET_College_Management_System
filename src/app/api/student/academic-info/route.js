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

    // --- AGGREGATED SHARED DATA QUERY ---
    // We group by subject identity and use subqueries to get the canonical (first) assignment's 
    // metadata while aggregating attendance across ALL assignments for that subject.
    const [subjects] = await db.execute(`
      SELECT 
        MIN(fsa.id) as assignment_id, -- Use MIN as the canonical ID for marks lookup
        fsa.subject_code,
        fsa.subject_name,
        MAX(fsa.mid_max) as mid_max,
        GROUP_CONCAT(DISTINCT c.name SEPARATOR ' & ') as faculty_name,
        
        -- Marks are linked to the canonical ID (logic implemented in faculty APIs)
        (SELECT sm.mid1_marks FROM student_marks sm 
         WHERE sm.student_id = ? AND sm.assignment_id = MIN(fsa.id)) as mid1_marks,
        (SELECT sm.mid2_marks FROM student_marks sm 
         WHERE sm.student_id = ? AND sm.assignment_id = MIN(fsa.id)) as mid2_marks,
        (SELECT sm.assignment_marks FROM student_marks sm 
         WHERE sm.student_id = ? AND sm.assignment_id = MIN(fsa.id)) as assignment_marks,

        -- Attendance is aggregated across ALL faculty assignments for this specific subject
        (SELECT COUNT(*) FROM student_attendance sa 
         WHERE sa.student_id = ? AND sa.assignment_id IN (
           SELECT id FROM faculty_subject_assignments fsa2 
           WHERE fsa2.subject_code = fsa.subject_code AND fsa2.branch = fsa.branch 
           AND fsa2.course_semester = fsa.course_semester AND fsa2.academic_year = fsa.academic_year
         )) as total_classes,
         
        (SELECT COUNT(*) FROM student_attendance sa 
         WHERE sa.student_id = ? AND sa.status = 'PRESENT' AND sa.assignment_id IN (
           SELECT id FROM faculty_subject_assignments fsa2 
           WHERE fsa2.subject_code = fsa.subject_code AND fsa2.branch = fsa.branch 
           AND fsa2.course_semester = fsa.course_semester AND fsa2.academic_year = fsa.academic_year
         )) as attended_classes

      FROM faculty_subject_assignments fsa
      JOIN clerks c ON fsa.faculty_id = c.id
      WHERE fsa.branch = ? AND fsa.course_semester = ? AND fsa.academic_year = ?
      GROUP BY fsa.subject_code, fsa.subject_name, fsa.branch, fsa.course_semester, fsa.academic_year
    `, [studentId, studentId, studentId, studentId, studentId, branch, semester, academicYear]);

    return apiResponse({ 
      data: subjects.map(s => ({
        ...s,
        subject_type: s.subject_name?.toLowerCase().includes('lab') ? 'lab' : 'theory'
      })),
      semester,
      academicYear
    });
  } catch (error) {
    console.error('Student Academic Info Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

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

    // --- AGGREGATED SYLLABUS-BASED DATA QUERY ---
    // We now start from the syllabus_structure table to ensure ALL leaf subjects (Core + Variants)
    // in the curriculum are listed. Group headers (is_group=1) are skipped in favor of their variants.
    const [subjects] = await db.execute(`
      SELECT 
        ss.subject_code,
        sb.subject_name,
        sb.subject_type,
        GROUP_CONCAT(DISTINCT c.name SEPARATOR ' & ') as faculty_name,
        MAX(fsa.mid_max) as mid_max,
        
        -- We use MIN(fsa.id) as a canonical reference for marks lookup if any assignment exists
        (SELECT MIN(fsa2.id) FROM faculty_subject_assignments fsa2 
         WHERE fsa2.subject_code = ss.subject_code AND fsa2.branch = ss.branch 
         AND fsa2.course_semester = ss.semester AND fsa2.academic_year = ?) as canonical_assignment_id,

        -- Marks are linked to the canonical assignment ID
        (SELECT sm.mid1_marks FROM student_marks sm 
         WHERE sm.student_id = ? AND sm.assignment_id = (
           SELECT MIN(fsa2.id) FROM faculty_subject_assignments fsa2 
           WHERE fsa2.subject_code = ss.subject_code AND fsa2.branch = ss.branch 
           AND fsa2.course_semester = ss.semester AND fsa2.academic_year = ?
         )) as mid1_marks,
        (SELECT sm.mid2_marks FROM student_marks sm 
         WHERE sm.student_id = ? AND sm.assignment_id = (
           SELECT MIN(fsa2.id) FROM faculty_subject_assignments fsa2 
           WHERE fsa2.subject_code = ss.subject_code AND fsa2.branch = ss.branch 
           AND fsa2.course_semester = ss.semester AND fsa2.academic_year = ?
         )) as mid2_marks,
        (SELECT sm.assignment_marks FROM student_marks sm 
         WHERE sm.student_id = ? AND sm.assignment_id = (
           SELECT MIN(fsa2.id) FROM faculty_subject_assignments fsa2 
           WHERE fsa2.subject_code = ss.subject_code AND fsa2.branch = ss.branch 
           AND fsa2.course_semester = ss.semester AND fsa2.academic_year = ?
         )) as assignment_marks,
        (SELECT sm.lab_theory_marks FROM student_marks sm 
         WHERE sm.student_id = ? AND sm.assignment_id = (
           SELECT MIN(fsa2.id) FROM faculty_subject_assignments fsa2 
           WHERE fsa2.subject_code = ss.subject_code AND fsa2.branch = ss.branch 
           AND fsa2.course_semester = ss.semester AND fsa2.academic_year = ?
         )) as lab_theory_marks,
        (SELECT sm.lab_execution_marks FROM student_marks sm 
         WHERE sm.student_id = ? AND sm.assignment_id = (
           SELECT MIN(fsa2.id) FROM faculty_subject_assignments fsa2 
           WHERE fsa2.subject_code = ss.subject_code AND fsa2.branch = ss.branch 
           AND fsa2.course_semester = ss.semester AND fsa2.academic_year = ?
         )) as lab_execution_marks,
        (SELECT sm.lab_record_marks FROM student_marks sm 
         WHERE sm.student_id = ? AND sm.assignment_id = (
           SELECT MIN(fsa2.id) FROM faculty_subject_assignments fsa2 
           WHERE fsa2.subject_code = ss.subject_code AND fsa2.branch = ss.branch 
           AND fsa2.course_semester = ss.semester AND fsa2.academic_year = ?
         )) as lab_record_marks,

        -- Attendance is aggregated across ALL faculty assignments for this specific subject
        (SELECT COUNT(*) FROM student_attendance sa 
         WHERE sa.student_id = ? AND sa.assignment_id IN (
           SELECT id FROM faculty_subject_assignments fsa2 
           WHERE fsa2.subject_code = ss.subject_code AND fsa2.branch = ss.branch 
           AND fsa2.course_semester = ss.semester AND fsa2.academic_year = ?
         )) as total_classes,
         
        (SELECT COUNT(*) FROM student_attendance sa 
         WHERE sa.student_id = ? AND sa.status IN ('PRESENT', 'NCC', 'MEDICAL') AND sa.assignment_id IN (
           SELECT id FROM faculty_subject_assignments fsa2 
           WHERE fsa2.subject_code = ss.subject_code AND fsa2.branch = ss.branch 
           AND fsa2.course_semester = ss.semester AND fsa2.academic_year = ?
         )) as attended_classes

      FROM syllabus_structure ss
      JOIN syllabus_subjects sb ON ss.subject_code = sb.subject_code
      LEFT JOIN faculty_subject_assignments fsa ON fsa.subject_code = ss.subject_code 
           AND fsa.branch = ss.branch AND fsa.course_semester = ss.semester 
           AND fsa.academic_year = ?
      LEFT JOIN clerks c ON fsa.faculty_id = c.id
      WHERE ss.branch = ? AND ss.semester = ? AND ss.is_group = 0
      GROUP BY ss.subject_code, sb.subject_name, sb.subject_type, ss.branch, ss.semester
    `, [
      academicYear, // canonical lookup
      studentId, academicYear, // mid1
      studentId, academicYear, // mid2
      studentId, academicYear, // assignment
      studentId, academicYear, // lab_theory
      studentId, academicYear, // lab_execution
      studentId, academicYear, // lab_record
      studentId, academicYear, // total_classes
      studentId, academicYear, // attended_classes
      academicYear, // fsa join
      branch,
      semester,
    ]);

    return apiResponse({ 
      data: subjects.map(s => ({
        ...s,
        assignment_id: s.canonical_assignment_id,
        mid_max: s.mid_max || 20 // Default to 20 if no faculty assignment exists
      })),
      semester,
      academicYear
    });
  } catch (error) {
    console.error('Student Academic Info Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

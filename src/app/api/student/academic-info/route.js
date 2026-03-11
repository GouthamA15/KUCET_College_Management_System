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

    // --- OPTIMIZED AGGREGATED DATA QUERY ---
    // This query uses LEFT JOINs and Conditional Aggregation to fetch everything in 1 pass.
    // It filters for canonical assignments (oldest assignment per subject-branch-sem-year)
    // and calculates both Marks and Attendance simultaneously.
    const [subjects] = await db.execute(`
      WITH CanonicalAssignments AS (
        SELECT 
          subject_code, branch, course_semester, academic_year,
          MIN(id) as id
        FROM faculty_subject_assignments
        WHERE branch = ? AND course_semester = ? AND academic_year = ?
        GROUP BY subject_code, branch, course_semester, academic_year
      )
      SELECT 
        ss.subject_code,
        sb.subject_name,
        sb.subject_type,
        ca.id as assignment_id,
        MAX(fsa_all.mid_max) as mid_max,
        GROUP_CONCAT(DISTINCT c.name SEPARATOR ' & ') as faculty_name,
        
        -- Marks (from canonical assignment only)
        sm.mid1_marks,
        sm.mid2_marks,
        sm.assignment_marks,
        sm.lab_theory_marks,
        sm.lab_execution_marks,
        sm.lab_record_marks,

        -- Attendance (aggregated across ALL faculty teaching this subject)
        COUNT(DISTINCT sa.id) as total_classes,
        COUNT(DISTINCT CASE WHEN sa.status IN ('PRESENT', 'NCC', 'MEDICAL') THEN sa.id END) as attended_classes

      FROM syllabus_structure ss
      JOIN syllabus_subjects sb ON ss.subject_code = sb.subject_code
      LEFT JOIN CanonicalAssignments ca ON ca.subject_code = ss.subject_code
      LEFT JOIN student_marks sm ON sm.student_id = ? AND sm.assignment_id = ca.id
      
      -- Join all faculty assignments for this subject to get faculty names and all attendance
      LEFT JOIN faculty_subject_assignments fsa_all ON fsa_all.subject_code = ss.subject_code 
           AND fsa_all.branch = ss.branch AND fsa_all.course_semester = ss.semester 
           AND fsa_all.academic_year = ?
      LEFT JOIN clerks c ON fsa_all.faculty_id = c.id
      
      -- Join attendance for the student across all assignments for this subject
      LEFT JOIN student_attendance sa ON sa.student_id = ? AND sa.assignment_id = fsa_all.id

      WHERE ss.branch = ? AND ss.semester = ? AND ss.is_group = 0
      GROUP BY ss.subject_code, sb.subject_name, sb.subject_type, ca.id, sm.id
    `, [
      branch, semester, academicYear, // CTE
      studentId,                      // Marks
      academicYear,                   // fsa_all join
      studentId,                      // Attendance sa join
      branch, semester                // Main WHERE
    ]);

    return apiResponse({ 
      data: subjects.map(s => ({
        ...s,
        mid_max: s.mid_max || 20 
      })),
      semester,
      academicYear
    });
  } catch (error) {
    console.error('Student Academic Info Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

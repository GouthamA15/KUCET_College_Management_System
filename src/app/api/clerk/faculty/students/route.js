import { 
  facultySubjectAssignments, 
  students as studentsTable, 
  studentMarks,
  facultySubstitutions,
  collegeInfo as collegeInfoTable
} from '@/db/schema';
import { db } from '@/db';
import { eq, and, asc, sql, or, like } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { branchCodes } from '@/lib/rollNumber';
import logger from '@/lib/logger';

export async function GET(request) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty') return apiError('Unauthorized', 401);

    const { searchParams } = new URL(request.url);
    const assignment_id = searchParams.get('assignment_id') ? parseInt(searchParams.get('assignment_id')) : null;

    if (!assignment_id) return apiError('Assignment ID is required', 400);

    // 1. Verify assignment existence
    const assignments = await db.select({
      id: facultySubjectAssignments.id,
      subject_code: facultySubjectAssignments.subject_code,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      academic_year: facultySubjectAssignments.academic_year,
      faculty_id: facultySubjectAssignments.faculty_id
    })
    .from(facultySubjectAssignments)
    .where(eq(facultySubjectAssignments.id, assignment_id))
    .limit(1);

    if (assignments.length === 0) return apiError('Assignment not found', 404);

    const assignment = assignments[0];
    const { subject_code, branch, course_semester, academic_year } = assignment;

    // 2. Authorization logic (Primary Faculty, HOD, or Substitute)
    let isAuthorized = false;

    if (assignment.faculty_id === user.id) {
      isAuthorized = true;
    } else if (user.is_hod && user.branch === assignment.branch) {
      isAuthorized = true;
    } else {
      // Check for active substitution (any date for the list view is fine)
      const substitution = await db.select()
        .from(facultySubstitutions)
        .where(and(
          eq(facultySubstitutions.original_assignment_id, assignment_id),
          eq(facultySubstitutions.substitute_faculty_id, user.id)
        ))
        .limit(1);
      
      if (substitution.length > 0) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return apiError('You are not authorized to view students for this assignment', 403);
    }

    // 3. Shared Data Logic: Canonical ID
    const canonicalRows = await db.select({ id: facultySubjectAssignments.id })
      .from(facultySubjectAssignments)
      .where(and(
        eq(facultySubjectAssignments.subject_code, subject_code),
        eq(facultySubjectAssignments.branch, branch),
        eq(facultySubjectAssignments.course_semester, course_semester),
        eq(facultySubjectAssignments.academic_year, academic_year)
      ))
      .orderBy(asc(facultySubjectAssignments.created_at))
      .limit(1);
    
    const targetAssignmentId = canonicalRows[0]?.id || assignment_id;

    // 4. Calculate expected entry years for the cohort
    const startYear = parseInt(academic_year.split('-')[0]);
    const studyingYear = Math.ceil(course_semester / 2);

    const branchCode = Object.keys(branchCodes).find(key => branchCodes[key] === branch);
    if (!branchCode) return apiError('Invalid branch in assignment', 400);

    /**
     * Cohort Logic with Detentions:
     * A student is in studyingYear if: (EffectiveYear - EntryYear + 1) - Offset = studyingYear
     * EntryYear = EffectiveYear + 1 - Offset - studyingYear
     * 
     * Since we only care about students in the current branch, we can filter by branch and the calculated studying year.
     */
    
    const students = await db.select({
      id: studentsTable.id,
      roll_no: studentsTable.roll_no,
      name: studentsTable.name,
      academic_offset_years: studentsTable.academic_offset_years,
      mid1_marks: studentMarks.mid1_marks,
      mid2_marks: studentMarks.mid2_marks,
      assignment_marks: studentMarks.assignment_marks
    })
    .from(studentsTable)
    .leftJoin(studentMarks, and(
      eq(studentsTable.id, studentMarks.student_id),
      eq(studentMarks.assignment_id, targetAssignmentId)
    ))
    .where(and(
      like(studentsTable.roll_no, `%${branchCode}%`), // Branch filter
      sql`CASE 
          WHEN ${studentsTable.roll_no} LIKE '%T%' THEN 
            (${startYear} - CAST(CONCAT('20', SUBSTRING(${studentsTable.roll_no}, 1, 2)) AS SIGNED) + 1) - ${studentsTable.academic_offset_years}
          WHEN ${studentsTable.roll_no} LIKE '%L' THEN 
            (${startYear} - CAST(CONCAT('20', SUBSTRING(${studentsTable.roll_no}, 1, 2)) AS SIGNED) + 2) - ${studentsTable.academic_offset_years}
          ELSE 0
        END = ${studyingYear}`
    ))
    .orderBy(asc(studentsTable.roll_no));

    return apiResponse({ data: students, sessions: [] });
  } catch (error) {
    logger.error('Students Fetch Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

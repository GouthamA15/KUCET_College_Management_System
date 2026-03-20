import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  facultySubjectAssignments, 
  students as studentsTable, 
  studentMarks 
} from '@/db/schema';
import { eq, and, asc, sql, or, like } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { branchCodes } from '@/lib/rollNumber';

export async function GET(request) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty') return apiError('Unauthorized', 401);

    const { searchParams } = new URL(request.url);
    const assignment_id = searchParams.get('assignment_id') ? parseInt(searchParams.get('assignment_id')) : null;

    if (!assignment_id) return apiError('Assignment ID is required', 400);

    const assignments = await db.select({
      id: facultySubjectAssignments.id,
      subject_code: facultySubjectAssignments.subject_code,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      academic_year: facultySubjectAssignments.academic_year
    })
    .from(facultySubjectAssignments)
    .where(and(
      eq(facultySubjectAssignments.id, assignment_id),
      eq(facultySubjectAssignments.faculty_id, user.id)
    ))
    .limit(1);

    if (assignments.length === 0) return apiError('Assignment not found or unauthorized', 404);

    const assignment = assignments[0];
    const { subject_code, branch, course_semester, academic_year } = assignment;

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

    const startYear = parseInt(academic_year.split('-')[0]);
    const studyingYear = Math.ceil(course_semester / 2);
    const entryYearRegular = (startYear - (studyingYear - 1)).toString().slice(-2);
    const entryYearLateral = (startYear - (studyingYear - 2)).toString().slice(-2);

    const branchCode = Object.keys(branchCodes).find(key => branchCodes[key] === branch);
    if (!branchCode) return apiError('Invalid branch in assignment', 400);

    const regularPattern = `${entryYearRegular}567T${branchCode}%`;
    const lateralPattern = `${entryYearLateral}567${branchCode}%L`;

    const studentConditions = [like(studentsTable.roll_no, regularPattern)];
    if (studyingYear >= 2) studentConditions.push(like(studentsTable.roll_no, lateralPattern));

    const students = await db.select({
      id: studentsTable.id,
      roll_no: studentsTable.roll_no,
      name: studentsTable.name,
      mid1_marks: studentMarks.mid1_marks,
      mid2_marks: studentMarks.mid2_marks,
      assignment_marks: studentMarks.assignment_marks
    })
    .from(studentsTable)
    .leftJoin(studentMarks, and(
      eq(studentsTable.id, studentMarks.student_id),
      eq(studentMarks.assignment_id, targetAssignmentId)
    ))
    .where(or(...studentConditions))
    .orderBy(asc(studentsTable.roll_no));

    return apiResponse({ data: students, sessions: [] });
  } catch (error) {
    logger.error('Students Fetch Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

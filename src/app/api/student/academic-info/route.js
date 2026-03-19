import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { db } from '@/db';
import { 
  collegeInfo as collegeInfoTable, 
  syllabusStructure, 
  syllabusSubjects, 
  studentMarks, 
  facultySubjectAssignments, 
  clerks, 
  studentAttendance 
} from '@/db/schema';
import { eq, and, min, sql, count, countDistinct } from 'drizzle-orm';
import { calculateYearAndSemesterAsync, getCollegeAcademicYear } from '@/lib/academic-utils';
import { getBranchFromRoll } from '@/lib/rollNumber';

export async function GET(request) {
  try {
    const user = await getAuthUser('student');
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const collegeRows = await db.select().from(collegeInfoTable).where(eq(collegeInfoTable.id, 1));
    const collegeInfo = collegeRows[0] || null;

    const { semester } = await calculateYearAndSemesterAsync(user.roll_no, collegeInfo);
    const academicYear = await getCollegeAcademicYear(collegeInfo);
    const branch = getBranchFromRoll(user.roll_no);
    const studentId = user.student_id;

    if (!studentId || !branch || !semester || !academicYear) {
      return apiError('Unable to determine student academic context', 400);
    }

    // --- OPTIMIZED AGGREGATED DATA QUERY USING DRIZZLE ---
    
    // 1. Define the CTE for Canonical Assignments
    const canonicalAssignments = db.$with('CanonicalAssignments').as(
      db.select({
        subject_code: facultySubjectAssignments.subject_code,
        id: min(facultySubjectAssignments.id).as('id')
      })
      .from(facultySubjectAssignments)
      .where(and(
        eq(facultySubjectAssignments.branch, branch),
        eq(facultySubjectAssignments.course_semester, semester),
        eq(facultySubjectAssignments.academic_year, academicYear)
      ))
      .groupBy(facultySubjectAssignments.subject_code)
    );

    // 2. Main query with joins and aggregations
    const subjects = await db.with(canonicalAssignments)
      .select({
        subject_code: syllabusStructure.subject_code,
        subject_name: syllabusSubjects.subject_name,
        subject_type: syllabusSubjects.subject_type,
        assignment_id: canonicalAssignments.id,
        mid_max: sql`MAX(${facultySubjectAssignments.mid_max})`,
        faculty_name: sql`GROUP_CONCAT(DISTINCT ${clerks.name} SEPARATOR ' & ')`,
        
        // Marks
        mid1_marks: studentMarks.mid1_marks,
        mid2_marks: studentMarks.mid2_marks,
        assignment_marks: studentMarks.assignment_marks,
        lab_theory_marks: studentMarks.lab_theory_marks,
        lab_execution_marks: studentMarks.lab_execution_marks,
        lab_record_marks: studentMarks.lab_record_marks,

        // Attendance
        total_classes: countDistinct(studentAttendance.id),
        attended_classes: sql`COUNT(DISTINCT CASE WHEN ${studentAttendance.status} IN ('PRESENT', 'NCC', 'MEDICAL') THEN ${studentAttendance.id} END)`
      })
      .from(syllabusStructure)
      .innerJoin(syllabusSubjects, eq(syllabusStructure.subject_code, syllabusSubjects.subject_code))
      .leftJoin(canonicalAssignments, eq(canonicalAssignments.subject_code, syllabusStructure.subject_code))
      .leftJoin(studentMarks, and(
        eq(studentMarks.student_id, studentId),
        eq(studentMarks.assignment_id, canonicalAssignments.id)
      ))
      .leftJoin(facultySubjectAssignments, and(
        eq(facultySubjectAssignments.subject_code, syllabusStructure.subject_code),
        eq(facultySubjectAssignments.branch, syllabusStructure.branch),
        eq(facultySubjectAssignments.course_semester, syllabusStructure.semester),
        eq(facultySubjectAssignments.academic_year, academicYear)
      ))
      .leftJoin(clerks, eq(facultySubjectAssignments.faculty_id, clerks.id))
      .leftJoin(studentAttendance, and(
        eq(studentAttendance.student_id, studentId),
        eq(studentAttendance.assignment_id, facultySubjectAssignments.id)
      ))
      .where(and(
        eq(syllabusStructure.branch, branch),
        eq(syllabusStructure.semester, semester),
        eq(syllabusStructure.is_group, false)
      ))
      .groupBy(
        syllabusStructure.subject_code, 
        syllabusSubjects.subject_name, 
        syllabusSubjects.subject_type, 
        canonicalAssignments.id,
        studentMarks.id
      );

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

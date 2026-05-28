import logger from '@/lib/logger';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { db } from '@/db';
import { 
  students as studentsTable,
  collegeInfo as collegeInfoTable, 
  syllabusStructure, 
  syllabusSubjects, 
  studentMarks, 
  facultySubjectAssignments, 
  clerks, 
  studentAttendance 
} from '@/db/schema';
import { eq, and, min, sql, countDistinct, or } from 'drizzle-orm';
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

    const { semester } = await calculateYearAndSemesterAsync(user.roll_no, collegeInfo, user.academic_offset_years || 0);
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
        canonical_id: min(facultySubjectAssignments.id).as('canonical_id')
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
        assignment_id: canonicalAssignments.canonical_id,
        mid_max: sql`MAX(${facultySubjectAssignments.mid_max})`,
        faculty_name: sql`GROUP_CONCAT(DISTINCT ${clerks.name} SEPARATOR ' & ')`,
        
        // Marks
        mid1_marks: studentMarks.mid1_marks,
        mid2_marks: studentMarks.mid2_marks,
        assignment_marks: studentMarks.assignment_marks,
        lab_theory_marks: studentMarks.lab_theory_marks,
        lab_execution_marks: studentMarks.lab_execution_marks,
        lab_record_marks: studentMarks.lab_record_marks,

        // Used only for backend-side dedupe
        _marks_row_id: studentMarks.id,
        _marks_created_at: studentMarks.created_at,
        _marks_updated_at: studentMarks.updated_at,

        // Attendance (Filtering by Admission Date to avoid Spot Admission penalty)
        total_classes: sql`COUNT(DISTINCT CASE WHEN ${studentAttendance.date} >= COALESCE(${studentsTable.admission_date}, '1900-01-01') THEN ${studentAttendance.id} END)`,
        attended_classes: sql`COUNT(DISTINCT CASE WHEN ${studentAttendance.status} IN ('PRESENT', 'NCC', 'MEDICAL') AND ${studentAttendance.date} >= COALESCE(${studentsTable.admission_date}, '1900-01-01') THEN ${studentAttendance.id} END)`
      })
      .from(syllabusStructure)
      .innerJoin(syllabusSubjects, eq(syllabusStructure.subject_code, syllabusSubjects.subject_code))
      .leftJoin(canonicalAssignments, eq(canonicalAssignments.subject_code, syllabusStructure.subject_code))
      .innerJoin(studentsTable, eq(studentsTable.id, studentId)) // Join students to get admission_date
      .leftJoin(studentMarks, and(
        eq(studentMarks.student_id, studentId),
        eq(studentMarks.assignment_id, canonicalAssignments.canonical_id),
        eq(studentMarks.is_published, true)
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
        canonicalAssignments.canonical_id,
        studentMarks.id,
        studentsTable.admission_date // Add to group by
      );

    // If student_marks already contains duplicates, the JOIN can yield repeated subject rows.
    // Deduplicate by subject_code, keeping the newest marks row (and preferring rows with marks).
    const pickBetter = (a, b) => {
      const countMarks = (row) => {
        const fields = [
          row.mid1_marks,
          row.mid2_marks,
          row.assignment_marks,
          row.lab_theory_marks,
          row.lab_execution_marks,
          row.lab_record_marks,
        ];
        return fields.reduce((acc, v) => acc + (v === null || v === undefined ? 0 : 1), 0);
      };

      const aMarks = countMarks(a);
      const bMarks = countMarks(b);
      if (aMarks !== bMarks) return bMarks > aMarks ? b : a;

      const aTime = a._marks_updated_at || a._marks_created_at || null;
      const bTime = b._marks_updated_at || b._marks_created_at || null;
      const aMs = aTime ? new Date(aTime).getTime() : 0;
      const bMs = bTime ? new Date(bTime).getTime() : 0;
      if (aMs !== bMs) return bMs > aMs ? b : a;

      const aId = a._marks_row_id || 0;
      const bId = b._marks_row_id || 0;
      return bId > aId ? b : a;
    };

    const dedupedBySubject = new Map();
    for (const row of subjects) {
      const key = row.subject_code;
      const existing = dedupedBySubject.get(key);
      dedupedBySubject.set(key, existing ? pickBetter(existing, row) : row);
    }

    const cleaned = Array.from(dedupedBySubject.values()).map(s => {
      const { _marks_row_id, _marks_created_at, _marks_updated_at, ...rest } = s;
      return { ...rest, mid_max: rest.mid_max || 20 };
    });

    return apiResponse({ 
      data: cleaned,
      semester,
      academicYear
    });
  } catch (error) {
    logger.error('Student Academic Info Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

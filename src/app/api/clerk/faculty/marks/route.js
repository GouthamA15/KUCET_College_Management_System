import { db } from '@/db';
import { 
  facultySubjectAssignments, 
  students as studentsTable, 
  studentMarks, 
  branchConfig, 
  collegeInfo as collegeInfoTable 
} from '@/db/schema';
import { eq, and, asc, sql, or, like } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser, logAudit } from '@/lib/api-utils';
import { isSemesterActive } from '@/lib/academic-utils';
import { branchCodes } from '@/lib/rollNumber';

export async function GET(request) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty') {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const assignment_id = searchParams.get('assignment_id') ? parseInt(searchParams.get('assignment_id')) : null;

    if (!assignment_id) {
      return apiError('Missing assignment_id', 400);
    }

    // Fetch assignment details
    const assignments = await db.select({
      id: facultySubjectAssignments.id,
      mid_max: facultySubjectAssignments.mid_max,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      academic_year: facultySubjectAssignments.academic_year,
      subject_name: facultySubjectAssignments.subject_name,
      subject_code: facultySubjectAssignments.subject_code
    })
    .from(facultySubjectAssignments)
    .where(and(
      eq(facultySubjectAssignments.id, assignment_id),
      eq(facultySubjectAssignments.faculty_id, user.id)
    ))
    .limit(1);

    if (assignments.length === 0) {
      return apiError('Assignment not found', 404);
    }

    const assignment = assignments[0];
    const { branch, course_semester, academic_year, subject_name, subject_code } = assignment;
    const midMax = assignment.mid_max || 20;
    const isLab = subject_name?.toLowerCase().includes('lab');

    // --- SHARED DATA LOGIC: Canonical ID ---
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
    
    const canonicalId = canonicalRows[0]?.id || assignment_id;

    // --- PRECISE SEMESTER-AWARE STUDENT FILTERING ---
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

    const studentConditions = [like(studentsTable.roll_no, regularPattern)];
    if (studyingYear >= 2) {
      studentConditions.push(like(studentsTable.roll_no, lateralPattern));
    }

    const students = await db.select({
      id: studentsTable.id,
      roll_no: studentsTable.roll_no,
      name: studentsTable.name,
      mid1_marks: studentMarks.mid1_marks,
      mid2_marks: studentMarks.mid2_marks,
      assignment_marks: studentMarks.assignment_marks,
      lab_theory_marks: studentMarks.lab_theory_marks,
      lab_execution_marks: studentMarks.lab_execution_marks,
      lab_record_marks: studentMarks.lab_record_marks
    })
    .from(studentsTable)
    .leftJoin(studentMarks, and(
      eq(studentsTable.id, studentMarks.student_id),
      eq(studentMarks.assignment_id, canonicalId)
    ))
    .where(or(...studentConditions))
    .orderBy(asc(studentsTable.roll_no));

    // Fetch HOD recommendation
    const configRows = await db.select({ mid_max: branchConfig.mid_max })
      .from(branchConfig)
      .where(and(
        eq(branchConfig.branch, branch),
        eq(branchConfig.academic_year, academic_year),
        eq(branchConfig.semester, course_semester)
      ))
      .limit(1);
    const recommendedMidMax = configRows[0]?.mid_max || null;

    return apiResponse({ 
      data: students, 
      mid_max: midMax, 
      recommended_mid_max: recommendedMidMax,
      subject_type: isLab ? 'lab' : 'theory',
      canonical_id: canonicalId 
    });
  } catch (error) {
    console.error('Marks Fetch Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function POST(request) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty') {
      return apiError('Unauthorized', 401);
    }

    const body = await request.json();
    const { assignment_id, marks_data, mid_max } = body;

    if (!assignment_id || !Array.isArray(marks_data) || marks_data.length === 0) {
      return apiError('Missing or empty marks data', 400);
    }

    const assignments = await db.select({
      id: facultySubjectAssignments.id,
      subject_code: facultySubjectAssignments.subject_code,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      academic_year: facultySubjectAssignments.academic_year,
      subject_name: facultySubjectAssignments.subject_name
    })
    .from(facultySubjectAssignments)
    .where(and(
      eq(facultySubjectAssignments.id, assignment_id),
      eq(facultySubjectAssignments.faculty_id, user.id)
    ))
    .limit(1);

    if (assignments.length === 0) {
      return apiError('Assignment not found', 404);
    }

    const assignment = assignments[0];
    const { subject_code, branch, course_semester, academic_year, subject_name } = assignment;
    const isLab = subject_name?.toLowerCase().includes('lab');

    // --- SHARED DATA LOGIC: Target Canonical ID ---
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

    const collegeRows = await db.select().from(collegeInfoTable).where(eq(collegeInfoTable.id, 1)).limit(1);
    const collegeInfo = collegeRows[0] || null;

    if (!await isSemesterActive(course_semester, academic_year, collegeInfo)) {
      return apiError('Semester has ended. Marks locked.', 403);
    }

    await db.transaction(async (tx) => {
      if (mid_max !== undefined) {
        await tx.update(facultySubjectAssignments)
          .set({ mid_max: mid_max })
          .where(eq(facultySubjectAssignments.id, targetAssignmentId));
      }

      const values = marks_data.map(item => {
        if (isLab) {
          return {
            student_id: item.student_id,
            assignment_id: targetAssignmentId,
            lab_theory_marks: item.lab_theory_marks ?? null,
            lab_execution_marks: item.lab_execution_marks ?? null,
            lab_record_marks: item.lab_record_marks ?? null
          };
        } else {
          return {
            student_id: item.student_id,
            assignment_id: targetAssignmentId,
            mid1_marks: item.mid1_marks ?? null,
            mid2_marks: item.mid2_marks ?? null,
            assignment_marks: item.assignment_marks ?? null
          };
        }
      });

      const updateSet = isLab 
        ? {
            lab_theory_marks: sql`VALUES(lab_theory_marks)`,
            lab_execution_marks: sql`VALUES(lab_execution_marks)`,
            lab_record_marks: sql`VALUES(lab_record_marks)`
          }
        : {
            mid1_marks: sql`VALUES(mid1_marks)`,
            mid2_marks: sql`VALUES(mid2_marks)`,
            assignment_marks: sql`VALUES(assignment_marks)`
          };

      await tx.insert(studentMarks)
        .values(values)
        .onDuplicateKeyUpdate({ set: updateSet });
    });

    // Audit Log
    await logAudit(request, {
      userId: user.id,
      userType: 'clerk',
      action: 'BULK_UPDATE_MARKS',
      targetId: targetAssignmentId,
      targetType: 'assignment',
      payload_after: { record_count: marks_data.length, mid_max }
    });
      
    return apiResponse({ message: `Successfully updated ${marks_data.length} records` });
  } catch (error) {
    console.error('Marks Bulk Update Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

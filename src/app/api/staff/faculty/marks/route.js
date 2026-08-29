import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  facultySubjectAssignments, 
  students as studentsTable, 
  studentMarks, 
  branchConfig, 
  collegeInfo as collegeInfoTable 
} from '@/db/schema';
import { eq, and, asc, desc, or, like, inArray, sql } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser, logAudit } from '@/lib/api-utils';
import { isSemesterActive } from '@/lib/academic-utils';
import { branchCodes } from '@/lib/rollNumber';
import { FacultyService } from '@/services/FacultyService';
import { _internalMarksSchema } from '@/lib/validations/staff';
import { z } from 'zod';

export async function GET(request) {
  try {
    const user = await getAuthUser('faculty');
    if (!user || (user.role !== 'faculty' && user.role !== 'admin')) {
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
      faculty_id: facultySubjectAssignments.staff_account_id,
      mid_max: facultySubjectAssignments.mid_max,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      academic_year: facultySubjectAssignments.academic_year,
      subject_name: facultySubjectAssignments.subject_name,
      subject_code: facultySubjectAssignments.subject_code
    })
    .from(facultySubjectAssignments)
    .where(eq(facultySubjectAssignments.id, assignment_id))
    .limit(1);

    if (assignments.length === 0) {
      return apiError('Assignment not found', 404);
    }

    const assignment = assignments[0];
    if (assignment.faculty_id !== user.id && !(user.is_hod && (user.branch === assignment.branch || !assignment.branch))) {
      return apiError('Unauthorized for this assignment', 403);
    }
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

    const branchCode = Object.keys(branchCodes).find(key => branchCodes[key] === branch);
    if (!branchCode) {
      return apiError('Invalid branch in assignment', 400);
    }

    const studentConditions = [
      like(studentsTable.roll_no, `%567T${branchCode}%`),
      like(studentsTable.roll_no, `%567${branchCode}%L`)
    ];

    const dynamicYearCondition = sql`CASE 
        WHEN ${studentsTable.roll_no} LIKE '%T%' THEN 
          (${startYear} - CAST(CONCAT('20', SUBSTRING(${studentsTable.roll_no}, 1, 2)) AS SIGNED) + 1) - ${studentsTable.academic_offset_years}
        WHEN ${studentsTable.roll_no} LIKE '%L' THEN 
          (${startYear} - CAST(CONCAT('20', SUBSTRING(${studentsTable.roll_no}, 1, 2)) AS SIGNED) + 2) - ${studentsTable.academic_offset_years}
        ELSE 0
      END = ${studyingYear}`;

    const students = await db.select({
      id: studentsTable.id,
      roll_no: studentsTable.roll_no,
      name: studentsTable.name,
      is_published: studentMarks.is_published,
      _marks_row_id: studentMarks.id,
      _marks_created_at: studentMarks.created_at,
      _marks_updated_at: studentMarks.updated_at,
      _marks_version: studentMarks.version,
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
    .where(and(
      eq(studentsTable.student_status, 'ACTIVE'),
      or(...studentConditions),
      dynamicYearCondition
    ))
    .orderBy(asc(studentsTable.roll_no));

    // If historical duplicates exist in student_marks, the join can yield duplicate student rows.
    // Deduplicate by student id, keeping the newest marks row.
    const pickNewest = (a, b) => {
      const aTime = a._marks_updated_at || a._marks_created_at || null;
      const bTime = b._marks_updated_at || b._marks_created_at || null;
      const aMs = aTime ? new Date(aTime).getTime() : 0;
      const bMs = bTime ? new Date(bTime).getTime() : 0;
      if (aMs !== bMs) return bMs > aMs ? b : a;
      const aId = a._marks_row_id || 0;
      const bId = b._marks_row_id || 0;
      return bId > aId ? b : a;
    };

    const dedupedByStudent = new Map();
    for (const row of students) {
      const existing = dedupedByStudent.get(row.id);
      dedupedByStudent.set(row.id, existing ? pickNewest(existing, row) : row);
    }

    const cleanedStudents = Array.from(dedupedByStudent.values()).map((s) => {
      const { _marks_row_id, _marks_created_at, _marks_updated_at, _marks_version, ...rest } = s;
      return { ...rest, marks_id: _marks_row_id, version: _marks_version || 1 };
    });

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
      data: cleanedStudents, 
      mid_max: midMax, 
      recommended_mid_max: recommendedMidMax,
      subject_type: isLab ? 'lab' : 'theory',
      canonical_id: canonicalId 
    });
  } catch (error) {
    logger.error('Marks Fetch Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function POST(request) {
  try {
    const user = await getAuthUser('faculty');
    if (!user || (user.role !== 'faculty' && user.role !== 'admin')) {
      return apiError('Unauthorized', 401);
    }

    const json = await request.json();

    // Validate with Zod
    const markValueSchema = z.preprocess(
      (v) => (v === '' || v === null || v === undefined) ? null : Number(v),
      z.number().min(0).max(100).nullable().optional()
    );

    const validationSchema = z.object({
      assignment_id: z.preprocess(v => Number(v), z.number().int().positive()),
      mid_max: z.number().int().min(1).max(100).optional(),
      publish: z.boolean().default(true),
      marks_data: z.array(z.object({
        student_id: z.number().int().positive(),
        mid1_marks: markValueSchema,
        mid2_marks: markValueSchema,
        assignment_marks: markValueSchema,
        lab_theory_marks: markValueSchema,
        lab_execution_marks: markValueSchema,
        lab_record_marks: markValueSchema,
        version: z.number().int().min(0).optional()
      })).min(1, "Marks data cannot be empty")
    });

    const validatedData = validationSchema.parse(json);
    const { assignment_id, marks_data, mid_max, publish: publishFlag } = validatedData;

    // Fetch assignment details
    const assignments = await db.select({
      id: facultySubjectAssignments.id,
      faculty_id: facultySubjectAssignments.staff_account_id,
      subject_code: facultySubjectAssignments.subject_code,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      academic_year: facultySubjectAssignments.academic_year,
      subject_name: facultySubjectAssignments.subject_name
    })
    .from(facultySubjectAssignments)
    .where(eq(facultySubjectAssignments.id, assignment_id))
    .limit(1);

    if (assignments.length === 0) {
      return apiError('Assignment not found', 404);
    }

    const assignment = assignments[0];
    if (assignment.faculty_id !== user.id && !(user.is_hod && (user.branch === assignment.branch || !assignment.branch))) {
      return apiError('Unauthorized for this assignment', 403);
    }
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

    // Check if marks are locked by HOD (Administrative Lock)
    const branchConfigs = await db.select({ is_locked: branchConfig.is_locked })
      .from(branchConfig)
      .where(and(
        eq(branchConfig.branch, branch),
        eq(branchConfig.academic_year, academic_year),
        eq(branchConfig.semester, course_semester)
      ))
      .limit(1);
    
    if (branchConfigs.length > 0 && branchConfigs[0].is_locked) {
      return apiError('Marks for this branch and semester have been finalized and locked by the HOD.', 403);
    }

    // Once any row is published for this subject, lock edits to avoid inconsistent history.
    const publishedRows = await db.select({ id: studentMarks.id })
      .from(studentMarks)
      .where(and(
        eq(studentMarks.assignment_id, targetAssignmentId),
        eq(studentMarks.is_published, true)
      ))
      .limit(1);

    if (publishedRows.length > 0) {
      return apiError('Marks already published and locked.', 403);
    }

    await db.transaction(async (tx) => {
      if (mid_max !== undefined) {
        await tx.update(facultySubjectAssignments)
          .set({ mid_max: mid_max })
          .where(eq(facultySubjectAssignments.id, targetAssignmentId));
      }

      // Deduplicate payload by student_id (last write wins) to avoid accidental double updates.
      const latestByStudent = new Map();
      for (const item of marks_data) {
        latestByStudent.set(item.student_id, item);
      }

      const studentIds = Array.from(latestByStudent.keys());
      if (studentIds.length === 0) return;

      // Fetch existing rows (including duplicates if any) and pick the latest per student.
      const existingRows = await tx.select({
        id: studentMarks.id,
        student_id: studentMarks.student_id,
        is_published: studentMarks.is_published,
        created_at: studentMarks.created_at,
        updated_at: studentMarks.updated_at,
        version: studentMarks.version,
      })
      .from(studentMarks)
      .where(and(
        eq(studentMarks.assignment_id, targetAssignmentId),
        inArray(studentMarks.student_id, studentIds)
      ))
      .orderBy(asc(studentMarks.student_id), desc(studentMarks.updated_at), desc(studentMarks.created_at), desc(studentMarks.id));

      const latestExistingByStudent = new Map();
      for (const row of existingRows) {
        if (!latestExistingByStudent.has(row.student_id)) {
          latestExistingByStudent.set(row.student_id, row);
        }
      }

      const rowsToInsert = [];

      for (const studentId of studentIds) {
        const item = latestByStudent.get(studentId);
        const existing = latestExistingByStudent.get(studentId);

        const markFields = isLab
          ? {
              lab_theory_marks: item.lab_theory_marks ?? null,
              lab_execution_marks: item.lab_execution_marks ?? null,
              lab_record_marks: item.lab_record_marks ?? null,
              is_published: publishFlag,
            }
          : {
              mid1_marks: item.mid1_marks ?? null,
              mid2_marks: item.mid2_marks ?? null,
              assignment_marks: item.assignment_marks ?? null,
              is_published: publishFlag,
            };

        if (existing?.id) {
          // Optimistic Locking: strictly use the version provided by the client.
          // If no version is provided for an existing record, we assume stale data or bypass attempt.
          const clientVersion = item.version;
          if (clientVersion === undefined || clientVersion === null) {
            throw new Error(`VERSION_MISSING:${studentId}`);
          }
          const success = await FacultyService.updateMarkAtomic(existing.id, markFields, clientVersion, tx);
          if (!success) {
            throw new Error(`CONCURRENCY_CONFLICT:${studentId}`);
          }
        } else {
          rowsToInsert.push({
            student_id: studentId,
            assignment_id: targetAssignmentId,
            ...markFields,
          });
        }
      }

      if (rowsToInsert.length > 0) {
        await tx.insert(studentMarks).values(rowsToInsert);
      }
    });

    // Audit Log
    await logAudit(request, {
      userId: user.id,
      userType: 'STAFF',
      action: 'BULK_UPDATE_MARKS',
      targetId: targetAssignmentId,
      targetType: 'assignment',
      payload_after: { record_count: marks_data.length, mid_max }
    });
      
    return apiResponse({ message: `Successfully updated ${marks_data.length} records` });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.errors?.[0]?.message || 'Invalid input data', 400);
    }
    if (error.message?.startsWith('CONCURRENCY_CONFLICT')) {
      return apiError('Concurrency Conflict: Another user has updated these marks. Please refresh and try again.', 409);
    }
    logger.error('Marks Bulk Update Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

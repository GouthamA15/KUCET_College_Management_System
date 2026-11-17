import logger from '@/lib/logger';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { fetchWithSWR } from '@/lib/cache';
import { db } from '@/db';
import {
  students as studentsTable,
  syllabusStructure,
  syllabusSubjects,
  studentMarks,
  facultySubjectAssignments,
  staffAccounts,
  studentAttendance,
  electiveGroups,
  electiveGroupSubjects
} from '@/db/schema';
import { eq, and, min, sql } from 'drizzle-orm';
import { calculateYearAndSemesterAsync, getCollegeAcademicYear } from '@/lib/academic-utils';
import { getBranchFromRoll } from '@/lib/rollNumber';

export async function GET(request) {
  try {
    const user = await getAuthUser('student');
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const querySemester = searchParams.get('semester');
    const queryAcademicYear = searchParams.get('academic_year');
    const isHistoricalRequest = Boolean(querySemester && queryAcademicYear);

    const academicSession = await calculateYearAndSemesterAsync(user.roll_no, user.academic_offset_years || 0);
    const { semester, status: sessionStatus, isCurrent } = academicSession;
    const resolvedAcademicYear = academicSession.academicYear || await getCollegeAcademicYear();
    const branch = getBranchFromRoll(user.roll_no);
    const studentId = user.student_id;

    if (sessionStatus === 'Semester Not Configured') {
      return apiError('Academic Calendar not configured.', 400);
    }

    // Scenario B: Term Break / Semester Inactive
    // Never silently fall back to expired semester subjects as the current semester
    if (!isHistoricalRequest && (sessionStatus !== 'ACTIVE' || !isCurrent)) {
      return apiResponse({
        data: [],
        semester: semester || null,
        academicYear: resolvedAcademicYear || null,
        status: sessionStatus,
        isCurrent: false,
        isTermBreak: true,
        message: sessionStatus === 'PREVIOUS'
          ? 'Academic semester has completed. Term break in progress.'
          : sessionStatus === 'UPCOMING'
          ? 'Upcoming academic semester has not yet commenced.'
          : 'No academic semester is currently active.'
      });
    }

    const targetSemester = isHistoricalRequest ? parseInt(querySemester, 10) : semester;
    const targetAcademicYear = isHistoricalRequest ? queryAcademicYear : resolvedAcademicYear;

    if (!studentId || !branch || !targetSemester || !targetAcademicYear) {
      return apiError('Unable to determine student academic context', 400);
    }

    const cacheKey = `academic_info:${studentId}:${branch}:${targetSemester}:${targetAcademicYear}`;

    const cachedResponse = await fetchWithSWR(cacheKey, async () => {
      // 1. Fetch elective groups and subjects mapped for this branch & semester
      const electiveGroupMappings = await db.select({
        groupId: electiveGroups.id,
        groupCode: electiveGroups.group_code,
        subjectCode: electiveGroupSubjects.subject_code
      })
      .from(electiveGroups)
      .innerJoin(electiveGroupSubjects, eq(electiveGroupSubjects.group_id, electiveGroups.id))
      .where(and(
        eq(electiveGroups.branch, branch),
        eq(electiveGroups.semester, targetSemester),
        eq(electiveGroups.is_active, true)
      ));

      const subjectToElectiveGroup = new Map();
      for (const mapping of electiveGroupMappings) {
        subjectToElectiveGroup.set(mapping.subjectCode, mapping.groupCode);
      }

      // 2. Define the CTE for Canonical Assignments with strict is_active = true
      const canonicalAssignments = db.$with('CanonicalAssignments').as(
        db.select({
          subject_code: facultySubjectAssignments.subject_code,
          canonical_id: min(facultySubjectAssignments.id).as('canonical_id')
        })
        .from(facultySubjectAssignments)
        .where(and(
          eq(facultySubjectAssignments.branch, branch),
          eq(facultySubjectAssignments.course_semester, targetSemester),
          eq(facultySubjectAssignments.academic_year, targetAcademicYear),
          eq(facultySubjectAssignments.is_active, true)
        ))
        .groupBy(facultySubjectAssignments.subject_code)
      );

      // 3. Main query with joins, aggregations, and strict active filtering
      const subjects = await db.with(canonicalAssignments)
        .select({
          subject_code: syllabusStructure.subject_code,
          subject_name: syllabusSubjects.subject_name,
          subject_type: syllabusSubjects.subject_type,
          parent_group_code: syllabusStructure.parent_group_code,
          is_group: syllabusStructure.is_group,
          assignment_id: canonicalAssignments.canonical_id,
          mid_max: sql`MAX(${facultySubjectAssignments.mid_max})`,
          faculty_name: sql`GROUP_CONCAT(DISTINCT ${staffAccounts.name} SEPARATOR ' & ')`,

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

          // Attendance (Filtering by Admission Date and Student's Lab Batch if applicable)
          total_classes: sql`(
            SELECT COUNT(DISTINCT s.id)
            FROM attendance_sessions s
            WHERE s.assignment_id = ${canonicalAssignments.canonical_id}
              AND s.attendance_date >= COALESCE(${studentsTable.admission_date}, '1900-01-01')
              AND (
                s.batch_number = 0
                OR s.batch_number IS NULL
                OR s.batch_number = (
                  SELECT lbs.batch_number
                  FROM lab_batch_students lbs
                  JOIN lab_batch_allocations lba ON lbs.allocation_id = lba.id
                  WHERE lbs.student_id = ${studentId}
                    AND lba.subject_code = ${syllabusStructure.subject_code}
                    AND lba.academic_year = ${targetAcademicYear}
                    AND lba.branch = ${branch}
                    AND lba.semester = ${targetSemester}
                  LIMIT 1
                )
                OR EXISTS (
                  SELECT 1 FROM student_attendance sa
                  WHERE sa.session_id = s.id
                    AND sa.student_id = ${studentId}
                )
              )
          )`,
          attended_classes: sql`COUNT(DISTINCT CASE WHEN ${studentAttendance.status} IN ('PRESENT', 'NCC', 'MEDICAL') AND ${studentAttendance.date} >= COALESCE(${studentsTable.admission_date}, '1900-01-01') THEN ${studentAttendance.id} END)`
        })
        .from(syllabusStructure)
        .innerJoin(syllabusSubjects, eq(syllabusStructure.subject_code, syllabusSubjects.subject_code))
        .leftJoin(canonicalAssignments, eq(canonicalAssignments.subject_code, syllabusStructure.subject_code))
        .innerJoin(studentsTable, eq(studentsTable.id, studentId))
        .leftJoin(studentMarks, and(
          eq(studentMarks.student_id, studentId),
          eq(studentMarks.assignment_id, canonicalAssignments.canonical_id),
          eq(studentMarks.is_published, true)
        ))
        .leftJoin(facultySubjectAssignments, and(
          eq(facultySubjectAssignments.subject_code, syllabusStructure.subject_code),
          eq(facultySubjectAssignments.branch, syllabusStructure.branch),
          eq(facultySubjectAssignments.course_semester, syllabusStructure.semester),
          eq(facultySubjectAssignments.academic_year, targetAcademicYear),
          eq(facultySubjectAssignments.is_active, true)
        ))
        .leftJoin(staffAccounts, eq(facultySubjectAssignments.staff_account_id, staffAccounts.id))
        .leftJoin(studentAttendance, and(
          eq(studentAttendance.student_id, studentId),
          eq(studentAttendance.assignment_id, facultySubjectAssignments.id)
        ))
        .where(and(
          eq(syllabusStructure.branch, branch),
          eq(syllabusStructure.semester, targetSemester),
          eq(syllabusStructure.is_group, false)
        ))
        .groupBy(
          syllabusStructure.subject_code,
          syllabusStructure.parent_group_code,
          syllabusStructure.is_group,
          syllabusSubjects.subject_name,
          syllabusSubjects.subject_type,
          canonicalAssignments.canonical_id,
          studentMarks.id,
          studentsTable.admission_date
        );

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

      const pickBetter = (a, b) => {
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

      // 4. Deduplicate multiple marks rows per subject
      const dedupedBySubject = new Map();
      for (const row of subjects) {
        const key = row.subject_code;
        const existing = dedupedBySubject.get(key);
        dedupedBySubject.set(key, existing ? pickBetter(existing, row) : row);
      }

      // 5. Elective Subject Resolution vs Compulsory Subjects
      // Compulsory subjects (not mapped to any elective group) are always included.
      // For elective groups:
      // - If the student has evaluated marks or recorded attendance for an elective, display that chosen elective.
      // - Otherwise, if only one option has an active faculty assignment, display that assigned elective.
      // - Do not list all available unselected alternatives as multiple enrolled subjects.
      const coreSubjects = [];
      const electiveGroupsMap = new Map();

      for (const row of dedupedBySubject.values()) {
        const groupCode = row.parent_group_code || subjectToElectiveGroup.get(row.subject_code) || null;
        row._group_code = groupCode;

        if (!groupCode) {
          coreSubjects.push(row);
        } else {
          if (!electiveGroupsMap.has(groupCode)) {
            electiveGroupsMap.set(groupCode, []);
          }
          electiveGroupsMap.get(groupCode).push(row);
        }
      }

      const selectedElectives = [];
      for (const [, variants] of electiveGroupsMap.entries()) {
        // Priority A: Student has active marks or attended classes for this specific variant
        const activeStudentVariants = variants.filter(v =>
          countMarks(v) > 0 || Number(v.attended_classes || 0) > 0
        );

        if (activeStudentVariants.length > 0) {
          activeStudentVariants.sort((a, b) => {
            const aActivity = countMarks(a) + Number(a.attended_classes || 0);
            const bActivity = countMarks(b) + Number(b.attended_classes || 0);
            return bActivity - aActivity;
          });
          selectedElectives.push(activeStudentVariants[0]);
          continue;
        }

        // Priority B: Single active faculty assignment for this cohort
        const assignedVariants = variants.filter(v => v.assignment_id !== null && v.assignment_id !== undefined);
        if (assignedVariants.length === 1) {
          selectedElectives.push(assignedVariants[0]);
          continue;
        }

        // Priority C: If multiple variants assigned or elective not yet finalized, pick primary assigned variant
        if (assignedVariants.length > 1) {
          selectedElectives.push(assignedVariants[0]);
        }
      }

      const finalSubjects = [...coreSubjects, ...selectedElectives];

      const cleaned = finalSubjects.map(s => {
        const { _marks_row_id, _marks_created_at, _marks_updated_at, _group_code, parent_group_code: _parent_group_code, is_group: _is_group, ...rest } = s;
        return {
          ...rest,
          mid_max: rest.mid_max || 20,
          is_elective: Boolean(_group_code),
          elective_group: _group_code || null
        };
      });

      return {
        data: cleaned,
        semester: targetSemester,
        academicYear: targetAcademicYear,
        status: isHistoricalRequest ? 'HISTORICAL' : sessionStatus,
        isCurrent: isHistoricalRequest ? false : isCurrent,
        isTermBreak: false
      };
    }, 60, 3600); // 60s stale, 1h max cache

    return apiResponse(cachedResponse);
  } catch (error) {
    logger.error('Student Academic Info Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

import logger from '@/lib/logger';
import { db } from '@/db';
import {
  facultySubjectAssignments,
  attendanceSessions,
  studentAttendance,
  students as studentsTable,
  staffAccounts,
  facultySubstitutions
} from '@/db/schema';
import { eq, and, asc, sql } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { branchCodes } from '@/lib/rollNumber';

export async function GET(request) {
  try {
    const user = await getAuthUser('faculty');
    if (!user || (user.role !== 'faculty' && user.role !== 'admin')) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const destination_assignment_id = searchParams.get('destination_assignment_id')
      ? parseInt(searchParams.get('destination_assignment_id'), 10)
      : null;
    const source_session_id = searchParams.get('source_session_id')
      ? parseInt(searchParams.get('source_session_id'), 10)
      : null;
    const destBatch = searchParams.get('destination_batch')
      ? parseInt(searchParams.get('destination_batch'), 10)
      : 0;

    if (!destination_assignment_id || isNaN(destination_assignment_id)) {
      return apiError('destination_assignment_id is required', 400);
    }

    if (!source_session_id || isNaN(source_session_id)) {
      return apiError('source_session_id is required', 400);
    }

    // 1. Fetch destination assignment
    const destAssignments = await db.select({
      id: facultySubjectAssignments.id,
      faculty_id: facultySubjectAssignments.staff_account_id,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      academic_year: facultySubjectAssignments.academic_year,
      subject_name: facultySubjectAssignments.subject_name,
      subject_code: facultySubjectAssignments.subject_code,
    })
    .from(facultySubjectAssignments)
    .where(eq(facultySubjectAssignments.id, destination_assignment_id))
    .limit(1);

    if (destAssignments.length === 0) {
      return apiError('Destination assignment not found', 404);
    }

    const destAssignment = destAssignments[0];

    // 2. Authorize faculty for destination assignment
    const authorizedBranches = (user.authorized_branches || (user.branch ? [user.branch] : [])).map(b => String(b).toUpperCase());
    const assignmentBranch = String(destAssignment.branch || '').toUpperCase();

    const isAssignedFaculty = destAssignment.faculty_id === user.id;
    const isGlobalAdminOrSupervisor = user.role === 'admin' || !!user.is_designated_supervisor || !!user.is_principal;
    const isHodForBranch = !!user.is_hod && (authorizedBranches.includes(assignmentBranch) || !destAssignment.branch);
    const isFirstYearCoord = !!user.is_first_year_coordinator && (destAssignment.course_semester === 1 || destAssignment.course_semester === 2);

    let isAuthorized = isAssignedFaculty || isGlobalAdminOrSupervisor || isHodForBranch || isFirstYearCoord;

    if (!isAuthorized) {
      const substitute = await db.select({ id: facultySubstitutions.id })
        .from(facultySubstitutions)
        .where(and(
          eq(facultySubstitutions.original_assignment_id, destination_assignment_id),
          eq(facultySubstitutions.substitute_faculty_id, user.id)
        ))
        .limit(1);

      if (substitute.length > 0) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return apiError('Forbidden: Not authorized for destination subject assignment', 403);
    }

    // 3. Fetch source session
    const sourceSessions = await db.select({
      id: attendanceSessions.id,
      assignment_id: attendanceSessions.assignment_id,
      attendance_date: attendanceSessions.attendance_date,
      session_number: attendanceSessions.session_number,
      batch_number: attendanceSessions.batch_number,
      faculty_id: attendanceSessions.faculty_id,
      topic_covered: attendanceSessions.topic_covered,
      submitted_at: attendanceSessions.submitted_at,
      total_students: attendanceSessions.total_students,
      present_count: attendanceSessions.present_count,
      absent_count: attendanceSessions.absent_count,
      faculty_name: staffAccounts.name,
    })
    .from(attendanceSessions)
    .leftJoin(staffAccounts, eq(attendanceSessions.faculty_id, staffAccounts.id))
    .where(eq(attendanceSessions.id, source_session_id))
    .limit(1);

    if (sourceSessions.length === 0) {
      return apiError('Source attendance session not found', 404);
    }

    const sourceSession = sourceSessions[0];

    // 4. Fetch source assignment and perform STRICT ZERO-TRUST COHORT VALIDATION
    const sourceAssignments = await db.select({
      id: facultySubjectAssignments.id,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      academic_year: facultySubjectAssignments.academic_year,
      subject_name: facultySubjectAssignments.subject_name,
      subject_code: facultySubjectAssignments.subject_code,
    })
    .from(facultySubjectAssignments)
    .where(eq(facultySubjectAssignments.id, sourceSession.assignment_id))
    .limit(1);

    if (sourceAssignments.length === 0) {
      return apiError('Source assignment record not found', 404);
    }

    const sourceAssignment = sourceAssignments[0];

    const isSameBranch = String(sourceAssignment.branch).toUpperCase() === String(destAssignment.branch).toUpperCase();
    const isSameSem = Number(sourceAssignment.course_semester) === Number(destAssignment.course_semester);
    const isSameYear = String(sourceAssignment.academic_year).trim() === String(destAssignment.academic_year).trim();

    if (!isSameBranch || !isSameSem || !isSameYear) {
      return apiError(
        `Cohort mismatch: Source session belongs to ${sourceAssignment.branch} Sem ${sourceAssignment.course_semester} (${sourceAssignment.academic_year}), whereas destination is ${destAssignment.branch} Sem ${destAssignment.course_semester} (${destAssignment.academic_year}). Cross-cohort reuse is strictly prohibited.`,
        400
      );
    }

    if (sourceSession.batch_number > 0 && destBatch > 0 && sourceSession.batch_number !== destBatch) {
      return apiError(
        `Batch mismatch: Source session belongs to Batch ${sourceSession.batch_number}, but target attendance is for Batch ${destBatch}. Attendance reuse between different batches is prohibited.`,
        400
      );
    }

    // 5. Fetch destination active student roster
    const branchCode = Object.keys(branchCodes).find(k => branchCodes[k] === destAssignment.branch);
    const studyingYear = Math.ceil(destAssignment.course_semester / 2);

    let destStudents = [];
    if (branchCode) {
      const rows = await db.select({
        id: studentsTable.id,
        roll_no: studentsTable.roll_no,
        name: studentsTable.name,
      })
      .from(studentsTable)
      .where(and(
        sql`SUBSTRING(${studentsTable.roll_no}, 6, 2) = ${branchCode}`,
        sql`(${studentsTable.student_status} IS NULL OR ${studentsTable.student_status} != 'INACTIVE_ATTENDANCE')`,
        sql`(${studentsTable.academic_status} IS NULL OR ${studentsTable.academic_status} NOT IN ('DETAINED', 'DROPPED', 'GRADUATED'))`,
        sql`(
          CASE
            WHEN SUBSTRING(${studentsTable.roll_no}, 9, 1) = 'L'
            THEN (YEAR(CURDATE()) - (2000 + CAST(SUBSTRING(${studentsTable.roll_no}, 1, 2) AS UNSIGNED)) + 2) - COALESCE(${studentsTable.academic_offset_years}, 0)
            ELSE (YEAR(CURDATE()) - (2000 + CAST(SUBSTRING(${studentsTable.roll_no}, 1, 2) AS UNSIGNED)) + 1) - COALESCE(${studentsTable.academic_offset_years}, 0)
          END
        ) = ${studyingYear}`
      ))
      .orderBy(asc(studentsTable.roll_no));

      destStudents = rows;
    }

    // Fallback: If cohort query returned 0 due to calendar offset or test environment, query students from previous attendance or base
    if (destStudents.length === 0) {
      const fallbackRows = await db.select({
        id: studentsTable.id,
        roll_no: studentsTable.roll_no,
        name: studentsTable.name,
      })
      .from(studentsTable)
      .innerJoin(studentAttendance, eq(studentsTable.id, studentAttendance.student_id))
      .where(eq(studentAttendance.assignment_id, destination_assignment_id))
      .groupBy(studentsTable.id, studentsTable.roll_no, studentsTable.name)
      .orderBy(asc(studentsTable.roll_no));

      destStudents = fallbackRows;
    }

    const destStudentMap = new Map();
    destStudents.forEach(s => destStudentMap.set(s.id, s));

    // 6. Fetch source attendance records
    const sourceRecords = await db.select({
      student_id: studentAttendance.student_id,
      status: studentAttendance.status,
    })
    .from(studentAttendance)
    .where(
      sourceSession.id
        ? eq(studentAttendance.session_id, sourceSession.id)
        : and(
            eq(studentAttendance.assignment_id, sourceSession.assignment_id),
            eq(studentAttendance.date, sourceSession.attendance_date),
            eq(studentAttendance.session, sourceSession.session_number)
          )
    );

    if (sourceRecords.length === 0) {
      return apiError('Source session contains no attendance records to copy.', 400);
    }

    // 7. Safe roster comparison & mapping
    const seenStudentIds = new Set();
    const matchedRecords = [];
    const sourceStudentIds = new Set();

    for (const r of sourceRecords) {
      if (seenStudentIds.has(r.student_id)) continue; // Deduplicate if any
      seenStudentIds.add(r.student_id);
      sourceStudentIds.add(r.student_id);

      // Only include students that belong to the destination class roster
      if (destStudentMap.has(r.student_id) || destStudents.length === 0) {
        matchedRecords.push({
          student_id: r.student_id,
          status: r.status,
        });
      }
    }

    // Identify missing students (e.g. newly admitted or lateral entries not recorded in source)
    const missingStudents = destStudents.filter(s => !sourceStudentIds.has(s.id));

    const code = String(sourceAssignment.subject_code || '').trim().toUpperCase();
    const name = String(sourceAssignment.subject_name || '').toLowerCase();
    const isLab = code.endsWith('L') || code.endsWith('LAB') || name.includes('lab') || name.includes('practical');

    return apiResponse({
      source_session: {
        session_id: sourceSession.id,
        assignment_id: sourceAssignment.id,
        subject_name: sourceAssignment.subject_name,
        subject_code: sourceAssignment.subject_code,
        subject_type: isLab ? 'Practical / Laboratory' : 'Theory',
        faculty_name: sourceSession.faculty_name || 'Faculty Member',
        attendance_date: sourceSession.attendance_date,
        session_number: sourceSession.session_number,
        topic_covered: sourceSession.topic_covered,
        total_students: sourceSession.total_students,
        present_count: sourceSession.present_count,
        absent_count: sourceSession.absent_count,
      },
      attendance_records: matchedRecords,
      missing_students: missingStudents,
      matched_count: matchedRecords.length,
      total_destination_students: destStudents.length,
      is_fully_compatible: missingStudents.length === 0,
    });
  } catch (err) {
    logger.error({ err, path: '/api/staff/faculty/attendance/reuse/session-data' }, 'Failed to fetch source session data for reuse');
    return apiError(err.message || 'Failed to fetch session data', 500);
  }
}

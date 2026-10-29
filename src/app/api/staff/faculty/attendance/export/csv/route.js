import { NextResponse } from 'next/server';
import { apiError, getAuthUser } from '@/lib/api-utils';
import { db } from '@/db';
import { 
  facultySubjectAssignments, 
  studentAttendance, 
  attendanceSessions, 
  students as studentsTable,
  staffAccounts,
  facultySubstitutions 
} from '@/db/schema';
import { eq, and, asc, sql, or, like } from 'drizzle-orm';
import { branchCodes } from '@/lib/rollNumber';
import { formatDate } from '@/lib/date';
import logger from '@/lib/logger';
import { z } from 'zod';

const querySchema = z.object({
  assignment_id: z.preprocess(v => Number(v), z.number().int().positive())
});

export async function GET(request) {
  try {
    const user = await getAuthUser('faculty');
    if (!user || (user.role !== 'faculty' && user.role !== 'admin')) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const parseResult = querySchema.safeParse({
      assignment_id: searchParams.get('assignment_id')
    });

    if (!parseResult.success) {
      return apiError(parseResult.error.errors?.[0]?.message || 'Invalid parameters', 400);
    }

    const { assignment_id } = parseResult.data;

    // 1. Fetch assignment details
    const assignments = await db.select({
      id: facultySubjectAssignments.id,
      subject_name: facultySubjectAssignments.subject_name,
      subject_code: facultySubjectAssignments.subject_code,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      academic_year: facultySubjectAssignments.academic_year,
      faculty_id: facultySubjectAssignments.staff_account_id,
      faculty_name: staffAccounts.name
    })
    .from(facultySubjectAssignments)
    .leftJoin(staffAccounts, eq(facultySubjectAssignments.staff_account_id, staffAccounts.id))
    .where(eq(facultySubjectAssignments.id, assignment_id))
    .limit(1);

    if (assignments.length === 0) {
      return apiError('Assignment not found', 404);
    }

    const assignment = assignments[0];
    const { subject_code, branch, course_semester, academic_year } = assignment;

    // 2. Authorization check
    let isAuthorized = false;
    if (user.role === 'admin' || assignment.faculty_id === user.id) {
      isAuthorized = true;
    } else if (user.is_principal || user.is_hod) {
      const authorizedBranches = user.authorized_branches || (user.branch ? [user.branch] : []);
      if (authorizedBranches.includes(branch) || user.branch === branch) {
        isAuthorized = true;
      }
    } else if (user.is_first_year_coordinator && (course_semester === 1 || course_semester === 2)) {
      isAuthorized = true;
    } else {
      const sub = await db.select()
        .from(facultySubstitutions)
        .where(and(
          eq(facultySubstitutions.original_assignment_id, assignment_id),
          eq(facultySubstitutions.substitute_faculty_id, user.id)
        ))
        .limit(1);
      if (sub.length > 0) isAuthorized = true;
    }

    if (!isAuthorized) {
      return apiError('Forbidden: You do not have permission to export attendance for this assignment', 403);
    }

    // 3. Resolve canonical assignment ID
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

    // 4. Query committed attendance records
    const attendanceRecords = await db.select({
      student_id: studentAttendance.student_id,
      roll_no: studentsTable.roll_no,
      name: studentsTable.name,
      date: sql`DATE_FORMAT(${studentAttendance.date}, '%Y-%m-%d')`,
      session: studentAttendance.session,
      status: studentAttendance.status
    })
    .from(studentAttendance)
    .innerJoin(studentsTable, eq(studentAttendance.student_id, studentsTable.id))
    .where(eq(studentAttendance.assignment_id, targetAssignmentId))
    .orderBy(asc(studentAttendance.date), asc(studentAttendance.session), asc(studentsTable.roll_no));

    if (attendanceRecords.length === 0) {
      return apiError('No submitted attendance records found for this subject assignment.', 404);
    }

    // 5. Query session metadata
    const sessionRows = await db.select({
      date: sql`DATE_FORMAT(${attendanceSessions.attendance_date}, '%Y-%m-%d')`,
      session: attendanceSessions.session_number,
      topic_covered: attendanceSessions.topic_covered
    })
    .from(attendanceSessions)
    .where(eq(attendanceSessions.assignment_id, targetAssignmentId));

    // 6. Distinct sessions chronologically
    const sessionMap = new Map();
    for (const record of attendanceRecords) {
      const key = `${record.date}__${record.session}`;
      if (!sessionMap.has(key)) {
        const metadata = sessionRows.find(s => s.date === record.date && s.session === record.session);
        sessionMap.set(key, {
          key,
          date: record.date,
          session: record.session,
          displayDate: formatDate(record.date),
          topic_covered: metadata?.topic_covered || null
        });
      }
    }

    const sessions = Array.from(sessionMap.values()).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.session - b.session;
    });

    const totalConducted = sessions.length;

    // 7. Canonical student roster
    const startYear = parseInt(academic_year.split('-')[0]);
    const studyingYear = Math.ceil(course_semester / 2);
    const branchCode = Object.keys(branchCodes).find(key => branchCodes[key] === branch);

    const studentMap = new Map();

    if (branchCode && !isNaN(startYear) && !isNaN(studyingYear)) {
      try {
        const eligibleCohort = await db.select({
          id: studentsTable.id,
          roll_no: studentsTable.roll_no,
          name: studentsTable.name,
        })
        .from(studentsTable)
        .where(and(
          eq(studentsTable.student_status, 'ACTIVE'),
          or(
            like(studentsTable.roll_no, `%567T${branchCode}%`),
            like(studentsTable.roll_no, `%567${branchCode}%L`)
          ),
          sql`CASE 
              WHEN ${studentsTable.roll_no} LIKE '%T%' THEN 
                (${startYear} - CAST(CONCAT('20', SUBSTRING(${studentsTable.roll_no}, 1, 2)) AS SIGNED) + 1) - ${studentsTable.academic_offset_years}
              WHEN ${studentsTable.roll_no} LIKE '%L' THEN 
                (${startYear} - CAST(CONCAT('20', SUBSTRING(${studentsTable.roll_no}, 1, 2)) AS SIGNED) + 2) - ${studentsTable.academic_offset_years}
              ELSE 0
            END = ${studyingYear}`
        ))
        .orderBy(asc(studentsTable.roll_no));

        for (const st of eligibleCohort) {
          studentMap.set(st.id, {
            student_id: st.id,
            roll_no: st.roll_no,
            name: st.name
          });
        }
      } catch (cohortErr) {
        logger.warn({ err: cohortErr }, 'Full Attendance CSV Export: Error resolving cohort');
      }
    }

    for (const record of attendanceRecords) {
      if (!studentMap.has(record.student_id)) {
        studentMap.set(record.student_id, {
          student_id: record.student_id,
          roll_no: record.roll_no,
          name: record.name
        });
      }
    }

    const students = Array.from(studentMap.values()).sort((a, b) =>
      (a.roll_no || '').localeCompare(b.roll_no || '')
    );

    // Matrix lookup
    const attendanceByStudentAndSession = new Map();
    for (const record of attendanceRecords) {
      const cellKey = `${record.student_id}__${record.date}__${record.session}`;
      attendanceByStudentAndSession.set(cellKey, record.status);
    }

    // 8. Build CSV output
    const csvRows = [];

    // Header info rows
    csvRows.push(['KU COLLEGE OF ENGINEERING & TECHNOLOGY - ATTENDANCE REGISTER'].map(escapeCSV).join(','));
    csvRows.push([`Subject: ${assignment.subject_name} (${subject_code})`, `Branch: ${branch}`, `Semester: ${course_semester}`, `Academic Year: ${academic_year}`].map(escapeCSV).join(','));
    csvRows.push([`Faculty: ${assignment.faculty_name || 'Course Faculty'}`, `Total Conducted Classes: ${totalConducted}`].map(escapeCSV).join(','));
    csvRows.push([]); // blank line

    // Column Headers
    const headerCols = ['S.No', 'Roll Number', 'Student Name'];
    for (const s of sessions) {
      headerCols.push(`${s.displayDate} (S${s.session})`);
    }
    headerCols.push('Total Classes', 'Total Present', 'Total Absent', 'Attendance %');
    csvRows.push(headerCols.map(escapeCSV).join(','));

    // Student Data Rows
    const sessionPresentCounts = {};
    for (const s of sessions) {
      sessionPresentCounts[s.key] = 0;
    }

    students.forEach((st, idx) => {
      let totalPresent = 0;
      let totalAbsent = 0;
      const row = [String(idx + 1), st.roll_no || '', st.name || ''];

      for (const s of sessions) {
        const cellKey = `${st.student_id}__${s.date}__${s.session}`;
        const status = attendanceByStudentAndSession.get(cellKey) || 'ABSENT';

        if (status === 'PRESENT') {
          totalPresent += 1;
          sessionPresentCounts[s.key] += 1;
          row.push('P');
        } else if (status === 'ABSENT') {
          totalAbsent += 1;
          row.push('A');
        } else {
          row.push(status);
        }
      }

      const pct = totalConducted > 0 ? Math.round((totalPresent / totalConducted) * 100) : 0;
      row.push(String(totalConducted), String(totalPresent), String(totalAbsent), `${pct}%`);
      csvRows.push(row.map(escapeCSV).join(','));
    });

    // Summary row
    const summaryRow = ['', 'TOTAL PRESENT', ''];
    for (const s of sessions) {
      summaryRow.push(String(sessionPresentCounts[s.key] || 0));
    }
    summaryRow.push('', '', '', '');
    csvRows.push(summaryRow.map(escapeCSV).join(','));

    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    const safeSubject = (subject_code || 'SUB').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `attendance_register_${safeSubject}_Sem${course_semester}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (err) {
    const requestId = request.headers.get('x-request-id') || request.headers.get('x-correlation-id') || null;
    logger.error({ err, requestId, url: request.url }, 'Attendance Full Export CSV Error');
    return apiError('Failed to generate full attendance CSV export', 500);
  }
}

function escapeCSV(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

import fs from 'fs';
import path from 'path';
import React from 'react';
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
import { formatDate, formatDateTime } from '@/lib/date';
import { Clock } from '@/lib/clock';
import { pdf } from '@react-pdf/renderer';
import FullAttendanceExportPDF from '@/pdf/templates/FullAttendanceExportPDF';
import logger from '@/lib/logger';
import { z } from 'zod';

let cachedLogoDataUrl = null;
function getCachedLogoDataUrl() {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  const candidateLogoPaths = [
    path.join(process.cwd(), 'public/assets/ku-college-logo.png'),
    path.join(process.cwd(), 'public/assets/ku-logo.png')
  ];
  for (const logoPath of candidateLogoPaths) {
    if (fs.existsSync(/*turbopackIgnore: true*/ logoPath)) {
      const logoBuf = fs.readFileSync(/*turbopackIgnore: true*/ logoPath);
      cachedLogoDataUrl = `data:image/png;base64,${logoBuf.toString('base64')}`;
      break;
    }
  }
  return cachedLogoDataUrl;
}

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

    // 3. Resolve canonical assignment ID for shared classes
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

    // 4. Query all committed attendance records for this assignment
    const attendanceRecords = await db.select({
      student_id: studentAttendance.student_id,
      roll_no: studentsTable.roll_no,
      name: studentsTable.name,
      date: sql`DATE_FORMAT(${studentAttendance.date}, '%Y-%m-%d')`,
      session: studentAttendance.session,
      status: studentAttendance.status,
      submitted_at: studentAttendance.submitted_at,
      created_at: studentAttendance.created_at
    })
    .from(studentAttendance)
    .innerJoin(studentsTable, eq(studentAttendance.student_id, studentsTable.id))
    .where(eq(studentAttendance.assignment_id, targetAssignmentId))
    .orderBy(asc(studentAttendance.date), asc(studentAttendance.session), asc(studentsTable.roll_no));

    if (attendanceRecords.length === 0) {
      return apiError('No submitted attendance records found for this subject assignment.', 404);
    }

    // 5. Query session metadata (topic covered, submission timestamp)
    const sessionRows = await db.select({
      date: sql`DATE_FORMAT(${attendanceSessions.attendance_date}, '%Y-%m-%d')`,
      session: attendanceSessions.session_number,
      topic_covered: attendanceSessions.topic_covered,
      submitted_at: attendanceSessions.submitted_at
    })
    .from(attendanceSessions)
    .where(eq(attendanceSessions.assignment_id, targetAssignmentId));

    // 6. Identify distinct submitted sessions chronologically
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
          topic_covered: metadata?.topic_covered || null,
          submitted_at: metadata?.submitted_at || record.submitted_at || record.created_at || null
        });
      }
    }

    const sessions = Array.from(sessionMap.values()).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.session - b.session;
    });

    const totalConducted = sessions.length;
    const earliestSession = sessions[0];
    const latestSession = sessions[sessions.length - 1];
    const reportPeriod = `${earliestSession.displayDate} to ${latestSession.displayDate}`;

    // 7. Resolve canonical student roster
    // Cohort active students + any student who has attendance rows in this assignment
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
          academic_offset_years: studentsTable.academic_offset_years
        })
        .from(studentsTable)
        .where(and(
          eq(studentsTable.student_status, 'ACTIVE'),
          or(
            like(studentsTable.roll_no, `%567T${branchCode}%`),
            like(studentsTable.roll_no, `%567${branchCode}%L`)
          )
        ))
        .orderBy(asc(studentsTable.roll_no));

        for (const st of eligibleCohort) {
          const roll = st.roll_no || '';
          const entryYearShort = parseInt(roll.slice(0, 2), 10);
          if (isNaN(entryYearShort)) continue;
          const entryYearFull = 2000 + entryYearShort;
          const offset = st.academic_offset_years || 0;
          let calculatedYear = 0;

          if (roll.includes('T')) {
            calculatedYear = (startYear - entryYearFull + 1) - offset;
          } else if (roll.endsWith('L')) {
            calculatedYear = (startYear - entryYearFull + 2) - offset;
          }

          if (calculatedYear === studyingYear) {
            studentMap.set(st.id, {
              student_id: st.id,
              roll_no: st.roll_no,
              name: st.name
            });
          }
        }
      } catch (cohortErr) {
        logger.warn({ err: cohortErr }, 'Full Attendance Export: Error resolving cohort students, falling back to recorded students');
      }
    }

    // Ensure all students who have attendance recorded are included
    for (const record of attendanceRecords) {
      if (!studentMap.has(record.student_id)) {
        studentMap.set(record.student_id, {
          student_id: record.student_id,
          roll_no: record.roll_no,
          name: record.name
        });
      }
    }

    // Sort all students canonically by roll_no
    const students = Array.from(studentMap.values()).sort((a, b) =>
      (a.roll_no || '').localeCompare(b.roll_no || '')
    );

    // 8. Build attendance matrix & statistics
    const attendanceByStudentAndSession = new Map();
    for (const record of attendanceRecords) {
      const cellKey = `${record.student_id}__${record.date}__${record.session}`;
      attendanceByStudentAndSession.set(cellKey, record.status);
    }

    const sessionStats = {};
    for (const s of sessions) {
      sessionStats[s.key] = {
        presentCount: 0,
        absentCount: 0,
        percentage: 0
      };
    }

    let grandTotalPresents = 0;

    const formattedStudents = students.map(st => {
      const records = {};
      let totalPresent = 0;
      let totalAbsent = 0;

      for (const s of sessions) {
        const cellKey = `${st.student_id}__${s.date}__${s.session}`;
        const status = attendanceByStudentAndSession.get(cellKey) || 'ABSENT';
        records[s.key] = status;

        if (status === 'PRESENT') {
          totalPresent += 1;
          sessionStats[s.key].presentCount += 1;
          grandTotalPresents += 1;
        } else {
          totalAbsent += 1;
          sessionStats[s.key].absentCount += 1;
        }
      }

      const percentage = totalConducted > 0 ? Math.round((totalPresent / totalConducted) * 100) : 0;

      return {
        ...st,
        records,
        totalPresent,
        totalAbsent,
        percentage
      };
    });

    for (const s of sessions) {
      const totalInSession = students.length;
      sessionStats[s.key].percentage = totalInSession > 0
        ? Math.round((sessionStats[s.key].presentCount / totalInSession) * 100)
        : 0;
    }

    const overallPercentage = (students.length > 0 && totalConducted > 0)
      ? Math.round((grandTotalPresents / (students.length * totalConducted)) * 100)
      : 0;

    const generationTimestamp = formatDateTime(Clock.now(request));

    // 9. Institutional Logo (In-Memory Cached Base64 data URI)
    const logoDataUrl = getCachedLogoDataUrl();

    // 10. Generate PDF
    const pdfBuffer = await pdf(
      React.createElement(FullAttendanceExportPDF, {
        logoUrl: logoDataUrl,
        collegeName: 'KU College of Engineering & Technology',
        universityName: 'Kakatiya University Campus, Warangal – 506009',
        branch,
        semester: course_semester,
        subjectCode: subject_code,
        subjectName: assignment.subject_name,
        academicYear: academic_year,
        facultyName: assignment.faculty_name || user.full_name || user.email || 'Course Faculty',
        generationTimestamp,
        reportPeriod,
        totalConducted,
        overallPercentage,
        sessions,
        students: formattedStudents,
        sessionStats
      })
    ).toBuffer();

    const safeSubject = (subject_code || 'SUB').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeBranch = (branch || 'BRANCH').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `attendance_register_${safeSubject}_${safeBranch}_Sem${course_semester}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (err) {
    const requestId = request.headers.get('x-request-id') || request.headers.get('x-correlation-id') || null;
    logger.error({ err, requestId, url: request.url }, 'Attendance Full Export PDF Error');
    return apiError('Failed to generate full attendance PDF export', 500);
  }
}

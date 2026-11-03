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
  students,
  staffAccounts,
  facultySubstitutions
} from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { formatDate, formatDateTime } from '@/lib/date';
import { Clock } from '@/lib/clock';
import { pdf } from '@react-pdf/renderer';
import AttendanceSessionPDF from '@/pdf/templates/AttendanceSessionPDF';
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
  assignment_id: z.preprocess(v => Number(v), z.number().int().positive()),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  session: z.preprocess(v => Number(v), z.number().int().min(1).max(8)),
  batch: z.preprocess(v => v !== undefined && v !== null && v !== '' ? Number(v) : null, z.number().int().min(0).max(2).optional().nullable())
});

export async function GET(request) {
  try {
    const user = await getAuthUser('faculty');
    if (!user || (user.role !== 'faculty' && user.role !== 'admin')) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const parseResult = querySchema.safeParse({
      assignment_id: searchParams.get('assignment_id'),
      date: searchParams.get('date'),
      session: searchParams.get('session'),
      batch: searchParams.get('batch')
    });

    if (!parseResult.success) {
      return apiError(parseResult.error.errors?.[0]?.message || 'Invalid parameters', 400);
    }

    const { assignment_id, date, session, batch } = parseResult.data;

    // 1. Verify assignment existence
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

    // Resolve canonical subject category (Theory vs Practical / Laboratory)
    const normType = assignment.canonical_subject_type ? String(assignment.canonical_subject_type).trim().toLowerCase() : null;
    const sName = (assignment.subject_name || '').toLowerCase();
    const sCode = (assignment.subject_code || '').toUpperCase();
    const isLab = normType === 'lab' || (!normType && (sName.includes('lab') || sName.includes('practical') || sName.includes('laboratory') || sCode.endsWith('L')));
    const subjectCategory = isLab ? 'Practical / Laboratory' : 'Theory';

    // 2. Authorization check
    let isAuthorized = false;
    if (assignment.faculty_id === user.id || user.role === 'admin') {
      isAuthorized = true;
    } else if (user.is_principal || user.is_hod) {
      const authorizedBranches = user.authorized_branches || (user.branch ? [user.branch] : []);
      if (authorizedBranches.includes(assignment.branch) || user.branch === assignment.branch) {
        isAuthorized = true;
      }
    } else if (user.is_first_year_coordinator && (assignment.course_semester === 1 || assignment.course_semester === 2)) {
      isAuthorized = true;
    } else {
      const sub = await db.select()
        .from(facultySubstitutions)
        .where(and(
          eq(facultySubstitutions.original_assignment_id, assignment_id),
          eq(facultySubstitutions.substitute_faculty_id, user.id),
          eq(facultySubstitutions.substitution_date, date)
        ))
        .limit(1);
      if (sub.length > 0) isAuthorized = true;
    }

    if (!isAuthorized) {
      return apiError('Forbidden: You do not have permission to view or export attendance for this assignment', 403);
    }

    // Resolve canonical assignment id for shared classes
    const canonicalRows = await db.select({ id: facultySubjectAssignments.id })
      .from(facultySubjectAssignments)
      .where(and(
        eq(facultySubjectAssignments.subject_code, assignment.subject_code),
        eq(facultySubjectAssignments.branch, assignment.branch),
        eq(facultySubjectAssignments.course_semester, assignment.course_semester),
        eq(facultySubjectAssignments.academic_year, assignment.academic_year)
      ))
      .orderBy(asc(facultySubjectAssignments.created_at))
      .limit(1);

    const targetAssignmentId = canonicalRows[0]?.id || assignment_id;

    // 4. Fetch session topic and submission timestamp via indexed lookup
    const sessionWhere = [
      eq(attendanceSessions.assignment_id, targetAssignmentId),
      eq(attendanceSessions.attendance_date, date),
      eq(attendanceSessions.session_number, session)
    ];
    if (batch !== null && batch !== undefined) {
      sessionWhere.push(eq(attendanceSessions.batch_number, batch));
    }

    const sessionRows = await db.select({
      id: attendanceSessions.id,
      batch_number: attendanceSessions.batch_number,
      topic_covered: attendanceSessions.topic_covered,
      submitted_at: attendanceSessions.submitted_at
    })
    .from(attendanceSessions)
    .where(and(...sessionWhere))
    .limit(1);

    const sessionData = sessionRows[0] || null;

    // 3. Query student attendance records
    const attendanceWhere = [
      eq(studentAttendance.assignment_id, targetAssignmentId),
      eq(studentAttendance.date, date),
      eq(studentAttendance.session, session)
    ];

    if (sessionData?.id) {
      attendanceWhere.push(eq(studentAttendance.session_id, sessionData.id));
    }

    const attendanceRecords = await db.select({
      student_id: studentAttendance.student_id,
      roll_no: students.roll_no,
      name: students.name,
      status: studentAttendance.status,
      submitted_at: studentAttendance.submitted_at,
      created_at: studentAttendance.created_at
    })
    .from(studentAttendance)
    .innerJoin(students, eq(studentAttendance.student_id, students.id))
    .where(and(...attendanceWhere))
    .orderBy(asc(students.roll_no));

    if (attendanceRecords.length === 0) {
      return apiError('No submitted attendance records found for this session.', 404);
    }

    const rawSubTime = sessionData?.submitted_at || attendanceRecords[0]?.submitted_at || attendanceRecords[0]?.created_at;
    const isHistorical = !sessionData?.submitted_at && !attendanceRecords[0]?.submitted_at;
    const submissionTimestamp = rawSubTime ? formatDateTime(rawSubTime) : 'Recorded';
    const generationTimestamp = formatDateTime(Clock.now(request));

    // Summary calculation: use authoritative record counts with fallback to cached session totals
    const totalCount = attendanceRecords.length;
    const presentCount = attendanceRecords.filter(r => r.status === 'PRESENT').length;
    const absentCount = attendanceRecords.filter(r => r.status === 'ABSENT').length;
    const nccCount = attendanceRecords.filter(r => r.status === 'NCC').length;
    const medicalCount = attendanceRecords.filter(r => r.status === 'MEDICAL').length;
    const attendedCount = presentCount + nccCount + medicalCount;
    const percentage = totalCount > 0 ? Math.round((attendedCount / totalCount) * 100) : 0;

    // 5. Institutional Logo (In-Memory Cached Base64 data URI)
    const logoDataUrl = getCachedLogoDataUrl();
    const effectiveBatch = batch !== null && batch !== undefined ? batch : (sessionData?.batch_number || 0);
    const batchName = effectiveBatch === 1 ? 'Batch 1' : effectiveBatch === 2 ? 'Batch 2' : null;

    const pdfBuffer = await pdf(
      React.createElement(AttendanceSessionPDF, {
        logoUrl: logoDataUrl,
        collegeName: 'KU College of Engineering & Technology',
        universityName: 'Kakatiya University Campus, Warangal – 506009',
        branch: assignment.branch,
        semester: assignment.course_semester,
        subjectCode: assignment.subject_code,
        subjectName: assignment.subject_name,
        academicYear: assignment.academic_year,
        date: formatDate(date),
        session,
        batchNumber: effectiveBatch,
        batchName,
        topicCovered: sessionData?.topic_covered || null,
        facultyName: assignment.faculty_name || user.full_name || user.email || 'Course Faculty',
        submissionTimestamp,
        generationTimestamp,
        subjectCategory,
        isLab,
        isHistoricalFallback: isHistorical,
        students: attendanceRecords,
        totals: {
          total: totalCount,
          present: presentCount,
          absent: absentCount,
          ncc: nccCount,
          medical: medicalCount,
          percentage
        }
      })
    ).toBuffer();

    const safeSubject = (assignment.subject_code || 'SUB').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeDate = formatDate(date).replace(/-/g, '_');
    const filename = `attendance_${safeSubject}_${safeDate}_S${session}.pdf`;

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
    logger.error({ err, requestId, url: request.url }, 'Attendance Session PDF Export Error');
    return apiError('Failed to generate attendance session PDF', 500);
  }
}

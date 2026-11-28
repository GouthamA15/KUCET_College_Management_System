import { db } from '@/db';
import {
  studentAttendance,
  attendanceSessions,
  archiveStudentAttendance,
  archiveAttendanceSessions,
  students as studentsTable,
  facultySubjectAssignments,
  labBatchAllocations,
  labBatchStudents
} from '@/db/schema';
import { eq, and, desc, gte, or, isNull, sql } from 'drizzle-orm';

function normalizeDateStr(val) {
  if (!val) return '';
  if (val instanceof Date) return val.toISOString().split('T')[0];
  return String(val).slice(0, 10);
}

/**
 * Service to calculate attendance for a single student and assignment.
 * Source of truth for sessions conducted: `attendance_sessions` (plus legacy `archive_attendance_sessions` fallback).
 * Source of truth for student status: `student_attendance` (plus legacy `archive_student_attendance` fallback).
 * Lab-wise batch aware: Only includes sessions for the student's allocated batch or whole-class sessions.
 */
export async function getStudentSubjectAttendance(studentId, assignmentId) {
  // 1. Get student admission date and assignment details
  const [studentData, assignmentData] = await Promise.all([
    db.select({ admission_date: studentsTable.admission_date })
      .from(studentsTable)
      .where(eq(studentsTable.id, studentId))
      .limit(1),
    db.select({
      subject_code: facultySubjectAssignments.subject_code,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      academic_year: facultySubjectAssignments.academic_year
    })
    .from(facultySubjectAssignments)
    .where(eq(facultySubjectAssignments.id, assignmentId))
    .limit(1)
  ]);

  const admissionDate = studentData[0]?.admission_date || new Date('1900-01-01');
  const assignment = assignmentData[0] || null;

  // 2. Resolve student's batch allocation for this subject, if any
  let studentBatch = null;
  if (assignment) {
    const allocRows = await db.select({
      batch_number: labBatchStudents.batch_number
    })
    .from(labBatchStudents)
    .innerJoin(labBatchAllocations, eq(labBatchStudents.allocation_id, labBatchAllocations.id))
    .where(and(
      eq(labBatchStudents.student_id, studentId),
      eq(labBatchAllocations.subject_code, assignment.subject_code),
      eq(labBatchAllocations.academic_year, assignment.academic_year),
      eq(labBatchAllocations.branch, assignment.branch),
      eq(labBatchAllocations.semester, assignment.course_semester)
    ))
    .limit(1);

    if (allocRows.length > 0) {
      studentBatch = allocRows[0].batch_number;
    }
  }

  // 3. Query conducted sessions eligible for this student (active + logically archived):
  const sessionConditions = [
    eq(attendanceSessions.assignment_id, assignmentId),
    gte(attendanceSessions.attendance_date, admissionDate)
  ];

  if (studentBatch) {
    sessionConditions.push(
      or(
        eq(attendanceSessions.batch_number, 0),
        isNull(attendanceSessions.batch_number),
        eq(attendanceSessions.batch_number, studentBatch),
        sql`EXISTS (
          SELECT 1 FROM student_attendance sa
          WHERE sa.session_id = ${attendanceSessions.id}
            AND sa.student_id = ${studentId}
        )`
      )
    );
  } else {
    sessionConditions.push(
      or(
        eq(attendanceSessions.batch_number, 0),
        isNull(attendanceSessions.batch_number),
        sql`EXISTS (
          SELECT 1 FROM student_attendance sa
          WHERE sa.session_id = ${attendanceSessions.id}
            AND sa.student_id = ${studentId}
        )`
      )
    );
  }

  const primarySessions = await db.select({
    id: attendanceSessions.id,
    date: attendanceSessions.attendance_date,
    sessionNumber: attendanceSessions.session_number,
    batchNumber: attendanceSessions.batch_number,
    topic: attendanceSessions.topic_covered,
    isArchived: attendanceSessions.is_archived,
  })
  .from(attendanceSessions)
  .where(and(...sessionConditions))
  .orderBy(desc(attendanceSessions.attendance_date), desc(attendanceSessions.session_number));

  // Merge legacy archive_attendance_sessions if any exist
  const sessionMap = new Map();
  for (const s of primarySessions || []) {
    const key = `${normalizeDateStr(s.date)}_${s.sessionNumber}_${s.batchNumber || 0}`;
    sessionMap.set(key, {
      ...s,
      date: normalizeDateStr(s.date),
      isArchived: Boolean(s.isArchived),
    });
  }

  try {
    const legacySessions = await db.select({
      id: archiveAttendanceSessions.original_session_id,
      archiveId: archiveAttendanceSessions.id,
      date: archiveAttendanceSessions.date,
      sessionNumber: archiveAttendanceSessions.session,
      topic: archiveAttendanceSessions.topic_covered,
    })
    .from(archiveAttendanceSessions)
    .where(and(
      eq(archiveAttendanceSessions.assignment_id, assignmentId),
      gte(archiveAttendanceSessions.date, admissionDate)
    ));

    for (const ls of legacySessions || []) {
      const dateStr = normalizeDateStr(ls.date);
      const key = `${dateStr}_${ls.sessionNumber}_0`;
      if (!sessionMap.has(key)) {
        sessionMap.set(key, {
          id: ls.id || -Number(ls.archiveId),
          date: dateStr,
          sessionNumber: ls.sessionNumber,
          batchNumber: 0,
          topic: ls.topic || null,
          isArchived: true,
        });
      }
    }
  } catch (_legacySessErr) {
    // Legacy table optional in mocked or pre-migration environments
  }

  const sessions = Array.from(sessionMap.values()).sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (b.sessionNumber || 0) - (a.sessionNumber || 0);
  });

  // 4. Get student's actual recorded attendance status (primary + legacy archive fallback, deduplicated)
  const primaryRecords = await db.select({
    date: studentAttendance.date,
    session: studentAttendance.session,
    status: studentAttendance.status,
    is_archived: studentAttendance.is_archived,
  })
  .from(studentAttendance)
  .where(and(
    eq(studentAttendance.student_id, studentId),
    eq(studentAttendance.assignment_id, assignmentId),
    gte(studentAttendance.date, admissionDate)
  ));

  const recordMap = new Map();
  for (const r of primaryRecords || []) {
    const dateStr = normalizeDateStr(r.date);
    recordMap.set(`${dateStr}_${r.session}`, {
      date: dateStr,
      session: r.session,
      status: r.status,
      is_archived: Boolean(r.is_archived),
    });
  }

  try {
    const legacyRecords = await db.select({
      date: archiveStudentAttendance.date,
      session: archiveStudentAttendance.session,
      status: archiveStudentAttendance.status,
    })
    .from(archiveStudentAttendance)
    .where(and(
      eq(archiveStudentAttendance.student_id, studentId),
      eq(archiveStudentAttendance.assignment_id, assignmentId),
      gte(archiveStudentAttendance.date, admissionDate)
    ));

    for (const lr of legacyRecords || []) {
      const dateStr = normalizeDateStr(lr.date);
      const key = `${dateStr}_${lr.session}`;
      if (!recordMap.has(key)) {
        recordMap.set(key, {
          date: dateStr,
          session: lr.session,
          status: lr.status,
          is_archived: true,
        });
      }
    }
  } catch (_legacyRecErr) {
    // Legacy table optional in mocked or pre-migration environments
  }

  // 5. Normalize and merge
  const classesHeld = sessions.length;
  let present = 0;
  let absent = 0;
  let ncc = 0;
  let medical = 0;
  let unrecorded = 0;

  const timeline = sessions.map(session => {
    const sessionDateStr = normalizeDateStr(session.date);
    const record = recordMap.get(`${sessionDateStr}_${session.sessionNumber}`);

    let status = 'Not Recorded';
    if (record) {
      status = record.status;
      if (status === 'PRESENT') present++;
      else if (status === 'ABSENT') absent++;
      else if (status === 'NCC') ncc++;
      else if (status === 'MEDICAL' || status === 'EXEMPTED') medical++;
    } else {
      unrecorded++;
      absent++;
    }

    return {
      date: sessionDateStr,
      sessionNumber: session.sessionNumber,
      batchNumber: session.batchNumber || 0,
      topic: session.topic || null,
      status,
      is_archived: Boolean(record?.is_archived ?? session.isArchived),
    };
  });

  const percentage = classesHeld > 0 ? (((present + ncc + medical) / classesHeld) * 100).toFixed(1) : 0;

  return {
    summary: {
      classesHeld,
      present,
      absent,
      ncc,
      medical,
      unrecorded,
      percentage: Number(percentage)
    },
    timeline
  };
}

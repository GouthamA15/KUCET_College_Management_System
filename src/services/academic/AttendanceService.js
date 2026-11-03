import { db } from '@/db';
import {
  studentAttendance,
  attendanceSessions,
  students as studentsTable,
  facultySubjectAssignments,
  labBatchAllocations,
  labBatchStudents
} from '@/db/schema';
import { eq, and, desc, gte, or, isNull, sql } from 'drizzle-orm';

/**
 * Service to calculate attendance for a single student and assignment.
 * Source of truth for sessions conducted: `attendance_sessions`.
 * Source of truth for student status: `student_attendance`.
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

  // 3. Query conducted sessions eligible for this student:
  // - Whole-class sessions (batch_number = 0 or NULL) are eligible for all students.
  // - Batch-specific sessions (batch_number = 1 or 2) are eligible ONLY if:
  //     a) The student is allocated to that batch (batch_number = studentBatch), OR
  //     b) The student has an actual attendance record in that session (preserves historical/override records).
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
    // If student has no batch allocation for this subject (e.g. Theory or not yet allocated),
    // include whole-class sessions plus any session where this student was recorded.
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

  const sessions = await db.select({
    id: attendanceSessions.id,
    date: attendanceSessions.attendance_date,
    sessionNumber: attendanceSessions.session_number,
    batchNumber: attendanceSessions.batch_number,
    topic: attendanceSessions.topic_covered
  })
  .from(attendanceSessions)
  .where(and(...sessionConditions))
  .orderBy(desc(attendanceSessions.attendance_date), desc(attendanceSessions.session_number));

  // 4. Get student's actual recorded attendance status
  const studentRecords = await db.select({
    date: studentAttendance.date,
    session: studentAttendance.session,
    status: studentAttendance.status
  })
  .from(studentAttendance)
  .where(and(
    eq(studentAttendance.student_id, studentId),
    eq(studentAttendance.assignment_id, assignmentId),
    gte(studentAttendance.date, admissionDate)
  ));

  // 5. Normalize and merge
  let classesHeld = sessions.length;
  let present = 0;
  let absent = 0;
  let ncc = 0;
  let medical = 0;
  let unrecorded = 0;

  const timeline = sessions.map(session => {
    const sessionDateStr = session.date instanceof Date ? session.date.toISOString().split('T')[0] : session.date;

    const record = studentRecords.find(r => {
      const rDateStr = r.date instanceof Date ? r.date.toISOString().split('T')[0] : r.date;
      return rDateStr === sessionDateStr && r.session === session.sessionNumber;
    });

    let status = 'Not Recorded';
    if (record) {
      status = record.status;
      if (status === 'PRESENT') present++;
      else if (status === 'ABSENT') absent++;
      else if (status === 'NCC') ncc++;
      else if (status === 'MEDICAL') medical++;
    } else {
      unrecorded++;
      // If an eligible session was conducted, but the student was not recorded, it effectively lowers attendance percentage.
      absent++;
    }

    return {
      date: sessionDateStr,
      sessionNumber: session.sessionNumber,
      batchNumber: session.batchNumber || 0,
      topic: session.topic || null,
      status: status
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

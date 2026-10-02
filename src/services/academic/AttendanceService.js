import { db } from '@/db';
import { studentAttendance, attendanceSessions, students as studentsTable } from '@/db/schema';
import { eq, and, desc, gte } from 'drizzle-orm';

/**
 * Service to calculate attendance for a single student and assignment.
 * Source of truth for sessions conducted: `attendance_sessions`.
 * Source of truth for student status: `student_attendance`.
 */
export async function getStudentSubjectAttendance(studentId, assignmentId) {
  // 1. Get student admission date to filter out sessions before they joined
  const studentData = await db.select({ admission_date: studentsTable.admission_date })
    .from(studentsTable)
    .where(eq(studentsTable.id, studentId))
    .limit(1);
    
  const admissionDate = studentData[0]?.admission_date || new Date('1900-01-01');

  // 2. Get all actual conducted sessions for this assignment (after admission date)
  const sessions = await db.select({
    id: attendanceSessions.id,
    date: attendanceSessions.attendance_date,
    sessionNumber: attendanceSessions.session_number,
    topic: attendanceSessions.topic_covered
  })
  .from(attendanceSessions)
  .where(and(
    eq(attendanceSessions.assignment_id, assignmentId),
    gte(attendanceSessions.attendance_date, admissionDate)
  ))
  .orderBy(desc(attendanceSessions.attendance_date), desc(attendanceSessions.session_number));

  // 3. Get student's actual recorded attendance status
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

  // 4. Normalize and merge
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
      // If a session was conducted, but the student was not recorded, it effectively lowers attendance percentage.
      // We will count it as ABSENT for the calculation, but label it "Not Recorded" in the timeline.
      absent++;
    }

    return {
      date: sessionDateStr,
      sessionNumber: session.sessionNumber,
      topic: session.topic || null,
      status: status
    };
  });

  const percentage = classesHeld > 0 ? (((present + ncc + medical) / classesHeld) * 100).toFixed(1) : 100;

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

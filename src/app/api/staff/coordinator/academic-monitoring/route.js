import { db } from '@/db';
import { 
  facultySubjectAssignments, 
  staffAccounts, 
  attendanceSessions, 
  studentAttendance,
  branchTimetable, 
  studentMarks, 
  students 
} from '@/db/schema';
import { eq, and, inArray, sql, asc, like } from 'drizzle-orm';
import { apiError, wrapHandler } from '@/lib/api-utils';
import { getCollegeAcademicYear, deriveDefaultAcademicYear } from '@/lib/academic-utils';

const INSTITUTIONAL_BRANCHES = ['CSE', 'IT', 'CSD', 'ECE', 'EEE', 'CIVIL', 'MECH'];

export const GET = wrapHandler({
  auth: ['first_year_coordinator', 'hod', 'faculty', 'admin'],
  handler: async (request, { user }) => {
    // 1. Authoritative Scope Check
    const isCoord = !!user.is_first_year_coordinator;
    const isSupervisor = !!user.is_designated_supervisor;
    const isAdmin = user.role === 'admin';

    if (!isCoord && !isSupervisor && !isAdmin) {
      return apiError('Forbidden - First Year Coordinator or Academic Supervisor authorization required.', 403);
    }

    const { searchParams } = new URL(request.url);
    const requestedBranch = searchParams.get('branch');
    const requestedSemester = searchParams.get('semester');
    const requestedYear = searchParams.get('academic_year') || searchParams.get('year');

    // First Year Coordinator is strictly restricted to Semesters 1 and 2
    let targetSemesters = [1, 2];
    if (requestedSemester && requestedSemester !== 'all') {
      const parsedSem = parseInt(requestedSemester, 10);
      if (parsedSem !== 1 && parsedSem !== 2) {
        return apiError('Forbidden - First Year Coordinator scope is strictly restricted to Semesters 1 and 2.', 403);
      }
      targetSemesters = [parsedSem];
    }

    // Branch filter: if provided and not 'all', validate against institutional branches
    let targetBranches = INSTITUTIONAL_BRANCHES;
    if (requestedBranch && requestedBranch !== 'all') {
      const normBranch = String(requestedBranch).toUpperCase().trim();
      if (!INSTITUTIONAL_BRANCHES.includes(normBranch)) {
        return apiError(`Invalid branch: ${normBranch}. Must be one of: ${INSTITUTIONAL_BRANCHES.join(', ')}`, 400);
      }
      targetBranches = [normBranch];
    }

    const currentYear = await getCollegeAcademicYear();
    const resolvedYear = requestedYear || currentYear || deriveDefaultAcademicYear();

    // 2. Fetch all First-Year Subject Assignments matching criteria
    const assignments = await db.select({
      id: facultySubjectAssignments.id,
      subject_code: facultySubjectAssignments.subject_code,
      subject_name: facultySubjectAssignments.subject_name,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      academic_year: facultySubjectAssignments.academic_year,
      staff_account_id: facultySubjectAssignments.staff_account_id,
      faculty_name: staffAccounts.name,
      faculty_email: staffAccounts.email,
      is_active: facultySubjectAssignments.is_active
    })
    .from(facultySubjectAssignments)
    .leftJoin(staffAccounts, eq(facultySubjectAssignments.staff_account_id, staffAccounts.id))
    .where(and(
      inArray(facultySubjectAssignments.course_semester, targetSemesters),
      inArray(facultySubjectAssignments.branch, targetBranches),
      eq(facultySubjectAssignments.academic_year, resolvedYear),
      eq(facultySubjectAssignments.is_active, true)
    ))
    .orderBy(facultySubjectAssignments.branch, facultySubjectAssignments.course_semester, facultySubjectAssignments.subject_code);

    const assignmentIds = assignments.map(a => a.id);

    // 3. Timetable Scheduled Slots Map
    const timetableSlotMap = new Map();
    try {
      const timetableSlots = await db.select({
        subject_code: branchTimetable.subject_code,
        branch: branchTimetable.branch,
        semester: branchTimetable.semester,
        academic_year: branchTimetable.academic_year,
        faculty_id: branchTimetable.faculty_id,
        count: sql`COUNT(${branchTimetable.id})`.mapWith(Number)
      })
      .from(branchTimetable)
      .where(and(
        inArray(branchTimetable.semester, targetSemesters),
        inArray(branchTimetable.branch, targetBranches),
        eq(branchTimetable.academic_year, resolvedYear)
      ))
      .groupBy(
        branchTimetable.subject_code,
        branchTimetable.branch,
        branchTimetable.semester,
        branchTimetable.academic_year,
        branchTimetable.faculty_id
      );

      timetableSlots.forEach(t => {
        const key = `${t.faculty_id}_${t.subject_code}_${t.branch}_${t.semester}`;
        timetableSlotMap.set(key, t.count);
      });
    } catch (_e) {
      // Non-fatal
    }

    // 4. Conducted Sessions & Last Date Map
    const sessionsMap = new Map();
    if (assignmentIds.length > 0) {
      try {
        const sessionStats = await db.select({
          assignment_id: attendanceSessions.assignment_id,
          session_count: sql`COUNT(${attendanceSessions.id})`.mapWith(Number),
          last_session_date: sql`MAX(${attendanceSessions.date})`.mapWith(String)
        })
        .from(attendanceSessions)
        .where(inArray(attendanceSessions.assignment_id, assignmentIds))
        .groupBy(attendanceSessions.assignment_id);

        sessionStats.forEach(s => {
          sessionsMap.set(s.assignment_id, {
            count: s.session_count,
            lastDate: s.last_session_date
          });
        });
      } catch (_e) {
        // Non-fatal
      }
    }

    // 5. Marks Status Aggregation
    const marksMap = new Map();
    if (assignmentIds.length > 0) {
      try {
        const marksStats = await db.select({
          assignment_id: studentMarks.assignment_id,
          total_entered: sql`COUNT(${studentMarks.id})`.mapWith(Number),
          published_count: sql`COUNT(CASE WHEN ${studentMarks.is_published} = 1 THEN 1 END)`.mapWith(Number),
          draft_count: sql`COUNT(CASE WHEN ${studentMarks.is_published} = 0 THEN 1 END)`.mapWith(Number)
        })
        .from(studentMarks)
        .where(inArray(studentMarks.assignment_id, assignmentIds))
        .groupBy(studentMarks.assignment_id);

        marksStats.forEach(m => {
          marksMap.set(m.assignment_id, {
            total: m.total_entered,
            published: m.published_count,
            draft: m.draft_count
          });
        });
      } catch (_e) {
        // Non-fatal
      }
    }

    // 6. Assemble Attendance Compliance & Marks Records
    let totalScheduledSlots = 0;
    let totalConductedSessions = 0;
    let compliantSubjectsCount = 0;
    let noSessionsCount = 0;

    let marksPublishedCount = 0;
    let marksDraftCount = 0;
    let marksPendingCount = 0;

    const complianceList = assignments.map(a => {
      const ttKey = `${a.staff_account_id}_${a.subject_code}_${a.branch}_${a.course_semester}`;
      const weeklySlots = timetableSlotMap.get(ttKey) || 0;
      const sInfo = sessionsMap.get(a.id) || { count: 0, lastDate: null };
      const mInfo = marksMap.get(a.id) || { total: 0, published: 0, draft: 0 };

      totalScheduledSlots += weeklySlots;
      totalConductedSessions += sInfo.count;

      let complianceStatus = 'ON_TRACK';
      let complianceLabel = 'On Track';
      if (sInfo.count === 0) {
        complianceStatus = 'NO_SESSIONS';
        complianceLabel = 'No Classes Recorded';
        noSessionsCount++;
      } else if (weeklySlots > 0 && sInfo.count < 3) {
        complianceStatus = 'NEEDS_ATTENTION';
        complianceLabel = 'Low Coverage';
      } else {
        compliantSubjectsCount++;
      }

      let marksStatus = 'PENDING';
      let marksLabel = 'Not Entered';
      if (mInfo.total > 0 && mInfo.draft > 0) {
        marksStatus = 'DRAFT';
        marksLabel = 'Draft / In Progress';
        marksDraftCount++;
      } else if (mInfo.total > 0 && mInfo.draft === 0) {
        marksStatus = 'PUBLISHED';
        marksLabel = 'Published & Locked';
        marksPublishedCount++;
      } else {
        marksPendingCount++;
      }

      return {
        assignment_id: a.id,
        subject_code: a.subject_code,
        subject_name: a.subject_name,
        branch: a.branch,
        course_semester: a.course_semester,
        academic_year: a.academic_year,
        faculty_name: a.faculty_name || 'Unassigned',
        faculty_email: a.faculty_email,
        weekly_scheduled_slots: weeklySlots,
        total_conducted_sessions: sInfo.count,
        last_session_date: sInfo.lastDate,
        compliance_status: complianceStatus,
        compliance_label: complianceLabel,
        marks_status: marksStatus,
        marks_label: marksLabel,
        marks_entered_count: mInfo.total,
        marks_published_count: mInfo.published,
        marks_draft_count: mInfo.draft
      };
    });

    // 7. Condonation / High-Risk Student Attendance for First Year
    let atRiskStudents = [];
    try {
      const yearPattern = `%${resolvedYear.substring(0, 4)}%`;
      const riskRows = await db.select({
        roll_no: students.roll_no,
        name: students.name,
        branch: students.branch,
        total_present: sql`COUNT(CASE WHEN ${studentAttendance.status} = 'PRESENT' THEN 1 END)`.mapWith(Number),
        total_sessions: sql`COUNT(${studentAttendance.id})`.mapWith(Number),
        percentage: sql`ROUND((COUNT(CASE WHEN ${studentAttendance.status} = 'PRESENT' THEN 1 END) / NULLIF(COUNT(${studentAttendance.id}), 0)) * 100, 1)`.mapWith(Number)
      })
      .from(students)
      .innerJoin(studentAttendance, eq(students.id, studentAttendance.student_id))
      .innerJoin(facultySubjectAssignments, eq(studentAttendance.assignment_id, facultySubjectAssignments.id))
      .where(and(
        eq(students.student_status, 'ACTIVE'),
        inArray(facultySubjectAssignments.course_semester, targetSemesters),
        inArray(facultySubjectAssignments.branch, targetBranches),
        like(facultySubjectAssignments.academic_year, yearPattern)
      ))
      .groupBy(students.id, students.roll_no, students.name, students.branch)
      .having(sql`ROUND((COUNT(CASE WHEN ${studentAttendance.status} = 'PRESENT' THEN 1 END) / NULLIF(COUNT(${studentAttendance.id}), 0)) * 100, 1) < 75`)
      .orderBy(asc(sql`ROUND((COUNT(CASE WHEN ${studentAttendance.status} = 'PRESENT' THEN 1 END) / NULLIF(COUNT(${studentAttendance.id}), 0)) * 100, 1)`))
      .limit(100);

      atRiskStudents = riskRows;
    } catch (_e) {
      // Non-fatal risk calculation
    }

    return {
      academic_year: resolvedYear,
      semesters: targetSemesters,
      branches: targetBranches,
      summary: {
        total_subjects: assignments.length,
        total_scheduled_weekly_slots: totalScheduledSlots,
        total_conducted_sessions: totalConductedSessions,
        compliant_subjects: compliantSubjectsCount,
        no_sessions_subjects: noSessionsCount,
        marks_published_count: marksPublishedCount,
        marks_draft_count: marksDraftCount,
        marks_pending_count: marksPendingCount,
        at_risk_students_count: atRiskStudents.length
      },
      records: complianceList,
      at_risk_students: atRiskStudents
    };
  }
});

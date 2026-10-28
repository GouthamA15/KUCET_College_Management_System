import { db } from '@/db';
import { 
  facultySubjectAssignments, 
  staffAccounts, 
  syllabusSubjects,
  attendanceSessions,
  branchTimetable,
  auditLogs 
} from '@/db/schema';
import { eq, and, desc, sql, or, inArray } from 'drizzle-orm';
import { apiResponse, apiError, wrapHandler } from '@/lib/api-utils';
import { isAcademicScopeAllowed } from '@/lib/academic-authorization';

export const GET = wrapHandler({
  auth: ['hod', 'first_year_coordinator', 'faculty'],
  handler: async (_request, { user, context }) => {
    const isHod = !!user.is_hod;
    const isCoord = !!user.is_first_year_coordinator;
    const isAdmin = user.role === 'admin' || !!user.is_principal;

    if (!isHod && !isCoord && !isAdmin) {
      return apiError('Unauthorized', 403);
    }

    const assignmentId = Number(context?.params?.id || (await context?.params)?.id);
    if (!assignmentId || isNaN(assignmentId)) {
      return apiError('Invalid assignment ID', 400);
    }

    // 1. Fetch assignment details
    const assignments = await db.select({
      id: facultySubjectAssignments.id,
      faculty_id: facultySubjectAssignments.staff_account_id,
      subject_code: facultySubjectAssignments.subject_code,
      subject_name: facultySubjectAssignments.subject_name,
      course_semester: facultySubjectAssignments.course_semester,
      academic_term: facultySubjectAssignments.academic_term,
      academic_year: facultySubjectAssignments.academic_year,
      branch: facultySubjectAssignments.branch,
      is_active: facultySubjectAssignments.is_active,
      created_at: facultySubjectAssignments.created_at,
      mid_max: facultySubjectAssignments.mid_max,
      faculty_name: staffAccounts.name,
      employee_id: staffAccounts.employee_id,
      faculty_email: staffAccounts.email,
      faculty_designation: staffAccounts.designation,
      subject_type: syllabusSubjects.subject_type
    })
    .from(facultySubjectAssignments)
    .innerJoin(staffAccounts, eq(facultySubjectAssignments.staff_account_id, staffAccounts.id))
    .leftJoin(syllabusSubjects, eq(facultySubjectAssignments.subject_code, syllabusSubjects.subject_code))
    .where(eq(facultySubjectAssignments.id, assignmentId))
    .limit(1);

    if (assignments.length === 0) {
      return apiError('Assignment not found', 404);
    }

    const assignment = assignments[0];

    // 2. Validate academic scope authorization
    if (!isAcademicScopeAllowed(user, { branch: assignment.branch, semester: assignment.course_semester })) {
      return apiError(`Forbidden - Not authorized for ${assignment.branch} Semester ${assignment.course_semester}`, 403);
    }

    // 3, 4, 5. Query timetable slots, attendance sessions, and change history in parallel
    let timetableSlots = [];
    let sessionCount = 0;
    let lastSessionDate = null;
    let changeHistory = [];

    try {
      const timetablePromise = db.select({
        day_of_week: branchTimetable.day_of_week,
        period_number: branchTimetable.period_number,
        room_no: branchTimetable.room_no
      })
      .from(branchTimetable)
      .where(and(
        eq(branchTimetable.faculty_id, assignment.faculty_id),
        eq(branchTimetable.subject_code, assignment.subject_code),
        eq(branchTimetable.branch, assignment.branch),
        eq(branchTimetable.semester, assignment.course_semester),
        eq(branchTimetable.academic_year, assignment.academic_year)
      ));

      const sessionPromise = db.select({
        count: sql`COUNT(DISTINCT ${attendanceSessions.id})`.mapWith(Number),
        last_date: sql`MAX(${attendanceSessions.session_date})`.mapWith(String)
      })
      .from(attendanceSessions)
      .where(eq(attendanceSessions.assignment_id, assignmentId));

      const auditPromise = db.select({
        id: auditLogs.id,
        action: auditLogs.action,
        user_id: auditLogs.user_id,
        user_type: auditLogs.user_type,
        created_at: auditLogs.created_at,
        payload_after: auditLogs.payload_after
      })
      .from(auditLogs)
      .where(and(
        eq(auditLogs.target_type, 'faculty_subject_assignments'),
        or(
          eq(auditLogs.target_id, String(assignmentId)),
          eq(auditLogs.target_id, assignment.subject_code)
        )
      ))
      .orderBy(desc(auditLogs.created_at))
      .limit(20);

      const [ttRes, sessionRows, logs] = await Promise.all([timetablePromise, sessionPromise, auditPromise]);

      timetableSlots = ttRes || [];

      if (sessionRows && sessionRows.length > 0) {
        sessionCount = sessionRows[0].count || 0;
        lastSessionDate = sessionRows[0].last_date || null;
      }

      // Resolve actor names if logs exist
      const actorIds = [...new Set((logs || []).map(l => l.user_id).filter(Boolean))];
      let actorMap = new Map();
      if (actorIds.length > 0) {
        try {
          const actors = await db.select({
            id: staffAccounts.id,
            name: staffAccounts.name
          })
          .from(staffAccounts)
          .where(inArray(staffAccounts.id, actorIds));
          actors.forEach(a => actorMap.set(a.id, a.name));
        } catch (_actorErr) {
          // Non-fatal
        }
      }

      changeHistory = (logs || []).map(l => {
        const payload = typeof l.payload_after === 'string' ? JSON.parse(l.payload_after || '{}') : (l.payload_after || {});
        return {
          id: l.id,
          action: l.action,
          actor_name: actorMap.get(l.user_id) || payload.actor_name || `Staff #${l.user_id}`,
          timestamp: l.created_at,
          override_reason: payload.override_reason || null,
          details: payload
        };
      });
    } catch (_e) {
      // Non-fatal telemetry enrichment
    }

    return apiResponse({
      data: {
        ...assignment,
        status: assignment.is_active ? 'ACTIVE' : 'ARCHIVED',
        timetable_slots: timetableSlots,
        total_conducted_sessions: sessionCount,
        last_session_date: lastSessionDate,
        change_history: changeHistory
      }
    });
  }
});

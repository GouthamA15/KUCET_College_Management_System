import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  facultySubjectAssignments, 
  attendanceSessions, 
  staffAccounts, 
  facultySubstitutions 
} from '@/db/schema';
import { eq, and, desc, sql, isNotNull } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(request) {
  try {
    const user = await getAuthUser('faculty');
    if (!user || (user.role !== 'faculty' && user.role !== 'admin')) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const assignment_id = searchParams.get('assignment_id') ? parseInt(searchParams.get('assignment_id'), 10) : null;
    const dateFilter = searchParams.get('date'); // Optional YYYY-MM-DD filter
    const batchFilter = searchParams.get('batch') ? parseInt(searchParams.get('batch'), 10) : null;

    if (!assignment_id || isNaN(assignment_id)) {
      return apiError('assignment_id is required', 400);
    }

    // 1. Fetch destination assignment to resolve cohort boundaries
    const assignments = await db.select({
      id: facultySubjectAssignments.id,
      faculty_id: facultySubjectAssignments.staff_account_id,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      academic_year: facultySubjectAssignments.academic_year,
      subject_name: facultySubjectAssignments.subject_name,
      subject_code: facultySubjectAssignments.subject_code,
    })
    .from(facultySubjectAssignments)
    .where(eq(facultySubjectAssignments.id, assignment_id))
    .limit(1);

    if (assignments.length === 0) {
      return apiError('Destination assignment not found', 404);
    }

    const destAssignment = assignments[0];

    // 2. Authorize faculty to access destination assignment
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
          eq(facultySubstitutions.original_assignment_id, assignment_id),
          eq(facultySubstitutions.substitute_faculty_id, user.id)
        ))
        .limit(1);

      if (substitute.length > 0) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return apiError('Forbidden: Not authorized for this subject assignment', 403);
    }

    // 3. Query all completed attendance sessions for the EXACT SAME COHORT
    // Cohort boundary: same academic_year, branch, course_semester
    // Join faculty_subject_assignments to get subject details and staff_accounts for faculty name
    const conditions = [
      eq(facultySubjectAssignments.academic_year, destAssignment.academic_year),
      eq(facultySubjectAssignments.branch, destAssignment.branch),
      eq(facultySubjectAssignments.course_semester, destAssignment.course_semester),
      isNotNull(attendanceSessions.submitted_at),
      sql`${attendanceSessions.total_students} > 0`,
    ];

    if (dateFilter && /^\d{4}-\d{2}-\d{2}$/.test(dateFilter)) {
      conditions.push(eq(attendanceSessions.attendance_date, dateFilter));
    }

    if (batchFilter !== null && !isNaN(batchFilter)) {
      conditions.push(eq(attendanceSessions.batch_number, batchFilter));
    }

    const eligibleRows = await db.select({
      session_id: attendanceSessions.id,
      assignment_id: facultySubjectAssignments.id,
      subject_name: facultySubjectAssignments.subject_name,
      subject_code: facultySubjectAssignments.subject_code,
      faculty_id: facultySubjectAssignments.staff_account_id,
      faculty_name: staffAccounts.name,
      attendance_date: attendanceSessions.attendance_date,
      session_number: attendanceSessions.session_number,
      batch_number: attendanceSessions.batch_number,
      total_students: attendanceSessions.total_students,
      present_count: attendanceSessions.present_count,
      absent_count: attendanceSessions.absent_count,
      topic_covered: attendanceSessions.topic_covered,
      submitted_at: attendanceSessions.submitted_at,
    })
    .from(attendanceSessions)
    .innerJoin(facultySubjectAssignments, eq(attendanceSessions.assignment_id, facultySubjectAssignments.id))
    .leftJoin(staffAccounts, eq(attendanceSessions.faculty_id, staffAccounts.id))
    .where(and(...conditions))
    .orderBy(
      desc(attendanceSessions.attendance_date),
      desc(attendanceSessions.session_number),
      desc(attendanceSessions.submitted_at)
    )
    .limit(50);

    const eligibleSessions = eligibleRows.map((r) => {
      const code = String(r.subject_code || '').trim().toUpperCase();
      const name = String(r.subject_name || '').toLowerCase();
      const isLab = code.endsWith('L') || code.endsWith('LAB') || name.includes('lab') || name.includes('practical');

      return {
        session_id: r.session_id,
        assignment_id: r.assignment_id,
        subject_name: r.subject_name,
        subject_code: r.subject_code,
        subject_type: isLab ? 'Practical / Laboratory' : 'Theory',
        faculty_name: r.faculty_name || 'Faculty Member',
        attendance_date: r.attendance_date,
        session_number: r.session_number || 1,
        batch_number: r.batch_number || 0,
        batch_name: r.batch_number === 1 ? 'Batch 1' : r.batch_number === 2 ? 'Batch 2' : null,
        total_students: r.total_students || 0,
        present_count: r.present_count || 0,
        absent_count: r.absent_count || 0,
        topic_covered: r.topic_covered || null,
        submitted_at: r.submitted_at,
        is_same_subject: r.assignment_id === destAssignment.id,
      };
    });

    return apiResponse({
      cohort: {
        branch: destAssignment.branch,
        course_semester: destAssignment.course_semester,
        academic_year: destAssignment.academic_year,
      },
      count: eligibleSessions.length,
      sessions: eligibleSessions,
    });
  } catch (err) {
    logger.error({ err, path: '/api/staff/faculty/attendance/reuse/eligible-sessions' }, 'Failed to fetch eligible reuse sessions');
    return apiError(err.message || 'Failed to fetch eligible sessions', 500);
  }
}

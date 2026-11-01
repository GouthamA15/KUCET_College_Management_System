import logger from '@/lib/logger';
import { db } from '@/db';
import { studentAttendance, facultySubjectAssignments, facultySubstitutions } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(request) {
  try {
    const user = await getAuthUser('faculty');
    if (!user || (user.role !== 'faculty' && user.role !== 'admin')) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const student_id = searchParams.get('student_id') ? parseInt(searchParams.get('student_id'), 10) : null;
    const assignment_id = searchParams.get('assignment_id') ? parseInt(searchParams.get('assignment_id'), 10) : null;

    if (!student_id || !assignment_id || isNaN(student_id) || isNaN(assignment_id)) {
      return apiError('Missing or invalid required parameters', 400);
    }

    // 1. Authoritative assignment resolution
    const assignments = await db.select({
      id: facultySubjectAssignments.id,
      faculty_id: facultySubjectAssignments.staff_account_id,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      academic_year: facultySubjectAssignments.academic_year
    })
    .from(facultySubjectAssignments)
    .where(eq(facultySubjectAssignments.id, assignment_id))
    .limit(1);

    if (assignments.length === 0) {
      return apiError('Assignment not found', 404);
    }

    const assignment = assignments[0];

    // 2. Multi-role authoritative access control (Anti-IDOR)
    const authorizedBranches = (user.authorized_branches || (user.branch ? [user.branch] : [])).map(b => String(b).toUpperCase());
    const assignmentBranch = String(assignment.branch || '').toUpperCase();

    const isAssignedFaculty = assignment.faculty_id === user.id;
    const isGlobalAdminOrSupervisor = user.role === 'admin' || !!user.is_designated_supervisor;
    const isHodForBranch = !!user.is_hod && (authorizedBranches.includes(assignmentBranch) || !assignment.branch);
    const isFirstYearCoordForSem = !!user.is_first_year_coordinator && (assignment.course_semester === 1 || assignment.course_semester === 2);

    let isAuthorized = isAssignedFaculty || isGlobalAdminOrSupervisor || isHodForBranch || isFirstYearCoordForSem;

    if (!isAuthorized) {
      // Check active substitute allocation
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
      return apiError('Forbidden: Not authorized to view attendance history for this assignment', 403);
    }

    // 3. Fetch history securely
    const history = await db.select({
      date: studentAttendance.date,
      status: studentAttendance.status,
      session: studentAttendance.session
    })
    .from(studentAttendance)
    .where(and(
      eq(studentAttendance.student_id, student_id),
      eq(studentAttendance.assignment_id, assignment_id)
    ))
    .orderBy(desc(studentAttendance.date), desc(studentAttendance.session));

    return apiResponse({ data: history });
  } catch (error) {
    logger.error('Attendance History Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

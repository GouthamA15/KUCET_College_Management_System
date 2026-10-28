import { db } from '@/db';
import { 
  facultySubjectAssignments, 
  facultySubjectInterests,
  staffAccounts,
  staffAccountRoles,
  staffRoles,
  collegeInfo as collegeInfoTable,
  syllabusStructure,
  attendanceSessions,
  studentMarks,
  auditLogs
} from '@/db/schema';
import { eq, and, asc, desc, inArray } from 'drizzle-orm';
import { apiResponse, apiError, wrapHandler } from '@/lib/api-utils';
import { getCollegeAcademicYear } from '@/lib/academic-utils';
import { 
  canDirectlyAllocateSubject, 
  assertAcademicYearNotLocked, 
  checkAllocationConflicts, 
  canOverrideAllocationConflict,
  notifyPrincipalLeadershipSelfAllocation,
  isAcademicScopeAllowed
} from '@/lib/academic-authorization';

export const GET = wrapHandler({
  auth: ['hod', 'first_year_coordinator', 'faculty'],
  handler: async (_request, { user }) => {
    const isHod = !!user.is_hod;
    const isCoord = !!user.is_first_year_coordinator;
    const isAdmin = user.role === 'admin' || !!user.is_principal;

    if (!isHod && !isCoord && !isAdmin) {
      return apiError('Unauthorized - HOD or First Year Coordinator role required', 403);
    }

    const requestedBranch = _request.nextUrl?.searchParams?.get('branch');
    const authorizedBranches = user.authorized_branches || (user.branch ? [user.branch] : []);

    if (!isAdmin && requestedBranch && !isCoord && authorizedBranches.length > 0 && !authorizedBranches.includes(requestedBranch)) {
      return apiError(`Forbidden - Not authorized for ${requestedBranch} branch.`, 403);
    }

    const conditions = [];

    // First Year Coordinator without HOD role sees Semesters 1 & 2 across branches
    if (isCoord && !isHod && !isAdmin) {
      conditions.push(inArray(facultySubjectAssignments.course_semester, [1, 2]));
      if (requestedBranch) {
        conditions.push(eq(facultySubjectAssignments.branch, requestedBranch));
      }
    } else if (!isAdmin) {
      const branchFilter = requestedBranch 
        ? [requestedBranch] 
        : (authorizedBranches.length > 0 ? authorizedBranches : (user.branch ? [user.branch] : []));
      
      if (branchFilter.length > 0) {
        conditions.push(inArray(facultySubjectAssignments.branch, branchFilter));
      }
    }

    const assignments = await db.select({
      id: facultySubjectAssignments.id,
      faculty_id: facultySubjectAssignments.staff_account_id,
      subject_code: facultySubjectAssignments.subject_code,
      subject_name: facultySubjectAssignments.subject_name,
      course_semester: facultySubjectAssignments.course_semester,
      academic_year: facultySubjectAssignments.academic_year,
      branch: facultySubjectAssignments.branch,
      faculty_name: staffAccounts.name,
      is_active: facultySubjectAssignments.is_active
    })
    .from(facultySubjectAssignments)
    .innerJoin(staffAccounts, eq(facultySubjectAssignments.staff_account_id, staffAccounts.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(facultySubjectAssignments.is_active), desc(facultySubjectAssignments.course_semester), asc(facultySubjectAssignments.subject_name));

    return apiResponse({ data: assignments });
  }
});

export const POST = wrapHandler({
  auth: ['hod', 'first_year_coordinator', 'faculty'],
  handler: async (request, { user }) => {
    const body = await request.json();
    const { 
      faculty_id, 
      subject_code, 
      subject_name, 
      branch, 
      semester, 
      academic_year,
      override_conflict = false,
      override_reason = ''
    } = body;

    if (!subject_code || !subject_name || !branch || !semester) {
      return apiError('Missing required fields: subject_code, subject_name, branch, semester are required.', 400);
    }
    
    if (academic_year && !academic_year.match(/^\d{4}-\d{2}$/)) {
      return apiError('Invalid academic_year format. Expected YYYY-YY', 400);
    }

    const normBranch = String(branch).toUpperCase().trim();
    const parsedSemester = parseInt(semester, 10);
    const target_faculty_id = faculty_id ? Number(faculty_id) : user.id;
    const isSelfAllocation = (target_faculty_id === user.id);

    // 1. Authoritative Role & Scope Verification
    const allocCheck = canDirectlyAllocateSubject(user, {
      branch: normBranch,
      semester: parsedSemester,
      target_faculty_id,
      is_self_allocation: isSelfAllocation
    });

    if (!allocCheck.allowed) {
      return apiError(allocCheck.reason || 'You do not have authorization to allocate subjects for this branch and semester.', 403);
    }

    // 2. Resolve Academic Year
    const collegeRows = await db.select().from(collegeInfoTable).where(eq(collegeInfoTable.id, 1)).limit(1);
    const collegeInfo = collegeRows[0] || null;
    const currentAcademicYear = await getCollegeAcademicYear(collegeInfo);
    const resolvedAcademicYear = academic_year || currentAcademicYear || '2025-26';

    // 3. Academic-Year Locking Protection
    await assertAcademicYearNotLocked({
      academic_year: resolvedAcademicYear,
      branch: normBranch,
      semester: parsedSemester
    });

    // 4. Validate subject exists in the specified branch syllabus
    const subjectCheck = await db.select({ subject_code: syllabusStructure.subject_code })
      .from(syllabusStructure)
      .where(and(
        eq(syllabusStructure.subject_code, subject_code),
        eq(syllabusStructure.branch, normBranch),
        eq(syllabusStructure.semester, parsedSemester)
      ))
      .limit(1);

    if (subjectCheck.length === 0) {
      return apiError(`Subject ${subject_code} does not exist in ${normBranch} Semester ${parsedSemester} syllabus.`, 400);
    }

    // 5. Verify target faculty is an active faculty member
    const facultyCheck = await db.select({ id: staffAccounts.id, name: staffAccounts.name })
      .from(staffAccounts)
      .innerJoin(staffAccountRoles, eq(staffAccountRoles.staff_account_id, staffAccounts.id))
      .innerJoin(staffRoles, eq(staffAccountRoles.role_id, staffRoles.id))
      .where(and(
        eq(staffAccounts.id, target_faculty_id),
        eq(staffAccounts.account_status, 'ACTIVE'),
        eq(staffRoles.role_code, 'FACULTY')
      ))
      .limit(1);

    if (facultyCheck.length === 0) {
      return apiError('Target staff member is not an active faculty member.', 400);
    }

    // 6. Conflict & Multiple Instructor Detection
    const conflictResult = await checkAllocationConflicts({
      faculty_id: target_faculty_id,
      subject_code,
      branch: normBranch,
      semester: parsedSemester,
      academic_year: resolvedAcademicYear
    });

    if (conflictResult.hasConflict) {
      if (!override_conflict) {
        return apiResponse({
          error: 'Allocation conflict detected.',
          hasConflict: true,
          canOverride: true,
          conflicts: conflictResult.conflicts,
          warnings: conflictResult.warnings
        }, 409);
      }

      // Verify permission to override
      const overrideCheck = canOverrideAllocationConflict(user, {
        branch: normBranch,
        semester: parsedSemester,
        reason: override_reason
      });

      if (!overrideCheck.allowed) {
        return apiError(overrideCheck.reason || 'You are not authorized to override conflicts or the reason provided is insufficient.', 403);
      }
    }

    let assignmentId = null;

    // 7. Duplicate Check / Idempotent Assignment
    const existingAssignment = await db.select({ id: facultySubjectAssignments.id, is_active: facultySubjectAssignments.is_active })
      .from(facultySubjectAssignments)
      .where(and(
        eq(facultySubjectAssignments.staff_account_id, target_faculty_id),
        eq(facultySubjectAssignments.subject_code, subject_code),
        eq(facultySubjectAssignments.branch, normBranch),
        eq(facultySubjectAssignments.course_semester, parsedSemester),
        eq(facultySubjectAssignments.academic_year, resolvedAcademicYear)
      ))
      .limit(1);

    if (existingAssignment.length > 0) {
      assignmentId = existingAssignment[0].id;
      if (existingAssignment[0].is_active) {
        // Idempotent: Active assignment exists, proceed to convert any pending interests
      } else {
        // Reactivate
        await db.update(facultySubjectAssignments)
          .set({ is_active: true })
          .where(eq(facultySubjectAssignments.id, assignmentId));
      }
    } else {
      const [insertRes] = await db.insert(facultySubjectAssignments).values({
        staff_account_id: target_faculty_id,
        subject_code: subject_code,
        subject_name: subject_name,
        branch: normBranch,
        course_semester: parsedSemester,
        academic_term: (parsedSemester % 2 === 0 ? 2 : 1),
        academic_year: resolvedAcademicYear,
        is_active: true
      });
      assignmentId = insertRes?.insertId;
    }

    // 8. Convert matching pending interest requests
    await db.update(facultySubjectInterests)
      .set({
        status: 'APPROVED',
        reviewed_by: user.id,
        reviewed_at: new Date()
      })
      .where(and(
        eq(facultySubjectInterests.staff_account_id, target_faculty_id),
        eq(facultySubjectInterests.subject_code, subject_code),
        eq(facultySubjectInterests.branch, normBranch),
        eq(facultySubjectInterests.semester, parsedSemester),
        eq(facultySubjectInterests.academic_year, resolvedAcademicYear),
        eq(facultySubjectInterests.status, 'PENDING')
      ));

    // 9. Audit Logging & Principal Notifications
    const clientIp = (request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || '127.0.0.1').trim().slice(0, 45);
    const userAgent = (request.headers.get('user-agent') || 'system').slice(0, 500);

    if (isSelfAllocation) {
      await notifyPrincipalLeadershipSelfAllocation(request, {
        actor: user,
        subject_code,
        subject_name,
        branch: normBranch,
        semester: parsedSemester,
        academic_year: resolvedAcademicYear,
        assignment_id: assignmentId,
        override_reason: override_conflict ? override_reason : null
      });
    } else {
      // Auditing allocation to another faculty member
      await db.insert(auditLogs).values({
        user_id: user.id,
        user_type: 'staff',
        action: user.is_first_year_coordinator ? 'COORDINATOR_ALLOCATE_FACULTY' : 'HOD_ALLOCATE_FACULTY',
        target_id: String(assignmentId || target_faculty_id),
        target_type: 'faculty_subject_assignments',
        payload_before: null,
        payload_after: {
          allocated_by: user.id,
          target_faculty_id,
          target_faculty_name: facultyCheck[0].name,
          subject_code,
          subject_name,
          branch: normBranch,
          semester: parsedSemester,
          academic_year: resolvedAcademicYear,
          override_conflict: !!override_conflict,
          override_reason: override_conflict ? override_reason : null
        },
        ip_address: clientIp,
        user_agent: userAgent
      });
    }

    return apiResponse({ 
      message: isSelfAllocation ? 'Subject self-allocated successfully' : 'Subject assigned successfully',
      assignment_id: assignmentId,
      warnings: conflictResult.warnings
    });
  }
});

export const DELETE = wrapHandler({
  auth: ['hod', 'first_year_coordinator', 'faculty'],
  handler: async (request, { user }) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') ? parseInt(searchParams.get('id'), 10) : null;

    if (!id) return apiError('Missing assignment ID', 400);

    // Verify the assignment exists
    const assignmentCheck = await db.select({ 
      id: facultySubjectAssignments.id,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      academic_year: facultySubjectAssignments.academic_year
    })
    .from(facultySubjectAssignments)
    .where(eq(facultySubjectAssignments.id, id))
    .limit(1);

    if (assignmentCheck.length === 0) {
      return apiError('Assignment not found.', 404);
    }

    const { branch, course_semester, academic_year } = assignmentCheck[0];

    // Verify academic scope
    if (!isAcademicScopeAllowed(user, { branch, semester: course_semester })) {
      return apiError(`Unauthorized: Assignment belongs to ${branch} Sem ${course_semester} which is outside your authorized scope.`, 403);
    }

    // Verify academic year is not locked
    await assertAcademicYearNotLocked({ academic_year, branch, semester: course_semester });

    // Safeguard historical attendance and evaluation records: Soft-deactivate if records exist
    const [attRows, marksRows] = await Promise.all([
      db.select({ id: attendanceSessions.id }).from(attendanceSessions).where(eq(attendanceSessions.assignment_id, id)).limit(1),
      db.select({ id: studentMarks.id }).from(studentMarks).where(eq(studentMarks.assignment_id, id)).limit(1)
    ]);

    if (attRows.length > 0 || marksRows.length > 0) {
      await db.update(facultySubjectAssignments).set({ is_active: false }).where(eq(facultySubjectAssignments.id, id));
      return apiResponse({ message: 'Subject assignment deactivated (attendance and evaluations preserved)' });
    }

    await db.delete(facultySubjectAssignments).where(eq(facultySubjectAssignments.id, id));

    return apiResponse({ message: 'Subject assignment removed successfully' });
  }
});


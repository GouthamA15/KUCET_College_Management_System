import { db } from '@/db';
import { 
  facultySubjectAssignments, 
  facultySubjectInterests,
  staffAccounts, 
  staffAccountRoles, 
  staffRoles,
  collegeInfo as collegeInfoTable, 
  syllabusStructure,
  syllabusSubjects,
  attendanceSessions,
  studentMarks,
  auditLogs,
  branchTimetable
} from '@/db/schema';
import { eq, and, asc, desc, inArray, or, like, sql } from 'drizzle-orm';
import { apiResponse, apiError, wrapHandler } from '@/lib/api-utils';
import { getCollegeAcademicYear } from '@/lib/academic-utils';
import { 
  canDirectlyAllocateSubject, 
  assertAcademicYearNotLocked, 
  checkAllocationConflicts, 
  canOverrideAllocationConflict,
  notifyPrincipalLeadershipSelfAllocation,
  isAcademicScopeAllowed,
  getAllowedAcademicSemesters
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

    const { searchParams } = new URL(_request.url);
    const requestedBranch = searchParams.get('branch');
    const requestedSemester = searchParams.get('semester');
    const requestedYear = searchParams.get('academic_year') || searchParams.get('year');
    const requestedStatus = searchParams.get('status') || 'all'; // 'all', 'active', 'archived'
    const requestedFacultyId = searchParams.get('faculty_id') ? Number(searchParams.get('faculty_id')) : null;
    const requestedSubjectCode = searchParams.get('subject_code');
    const searchQuery = searchParams.get('search')?.trim().toLowerCase();
    const includeCoverage = searchParams.get('include_coverage') === 'true';

    const authorizedBranches = user.authorized_branches || (user.branch ? [user.branch] : []);

    // 1. Validate branch authorization
    if (!isAdmin && requestedBranch && !isCoord && authorizedBranches.length > 0 && !authorizedBranches.includes(requestedBranch)) {
      return apiError(`Forbidden - Not authorized for ${requestedBranch} branch.`, 403);
    }

    // 2. Validate semester authorization
    if (requestedSemester && requestedSemester !== 'all') {
      const semInt = Number(requestedSemester);
      if (isCoord && !isHod && !isAdmin && (semInt < 1 || semInt > 2)) {
        return apiError('Forbidden - First Year Coordinator is strictly restricted to Semesters 1 and 2.', 403);
      }
      if (requestedBranch && !isAcademicScopeAllowed(user, { branch: requestedBranch, semester: semInt })) {
        return apiError(`Forbidden - Not authorized for ${requestedBranch} Semester ${semInt}.`, 403);
      }
    }

    // 3. Build conditions for assignments query
    const conditions = [];

    // Role-based scope restrictions
    if (isCoord && !isHod && !isAdmin) {
      // Coordinator sees Sem 1 & 2 across branches
      if (requestedSemester && requestedSemester !== 'all') {
        conditions.push(eq(facultySubjectAssignments.course_semester, Number(requestedSemester)));
      } else {
        conditions.push(inArray(facultySubjectAssignments.course_semester, [1, 2]));
      }
      if (requestedBranch && requestedBranch !== 'all') {
        conditions.push(eq(facultySubjectAssignments.branch, requestedBranch));
      }
    } else if (!isAdmin) {
      const branchFilter = (requestedBranch && requestedBranch !== 'all')
        ? [requestedBranch] 
        : (authorizedBranches.length > 0 ? authorizedBranches : (user.branch ? [user.branch] : []));
      
      if (branchFilter.length > 0) {
        conditions.push(inArray(facultySubjectAssignments.branch, branchFilter));
      }

      if (requestedSemester && requestedSemester !== 'all') {
        conditions.push(eq(facultySubjectAssignments.course_semester, Number(requestedSemester)));
      }
    } else {
      // Admin: optional branch and semester filters
      if (requestedBranch && requestedBranch !== 'all') {
        conditions.push(eq(facultySubjectAssignments.branch, requestedBranch));
      }
      if (requestedSemester && requestedSemester !== 'all') {
        conditions.push(eq(facultySubjectAssignments.course_semester, Number(requestedSemester)));
      }
    }

    // Academic Year filter
    if (requestedYear && requestedYear !== 'all') {
      conditions.push(eq(facultySubjectAssignments.academic_year, requestedYear));
    }

    // Status filter
    if (requestedStatus === 'active') {
      conditions.push(eq(facultySubjectAssignments.is_active, true));
    } else if (requestedStatus === 'archived') {
      conditions.push(eq(facultySubjectAssignments.is_active, false));
    }

    // Specific faculty filter
    if (requestedFacultyId) {
      conditions.push(eq(facultySubjectAssignments.staff_account_id, requestedFacultyId));
    }

    // Specific subject filter
    if (requestedSubjectCode) {
      conditions.push(eq(facultySubjectAssignments.subject_code, requestedSubjectCode));
    }

    // 4. Query assignments with rich metadata
    const assignments = await db.select({
      id: facultySubjectAssignments.id,
      faculty_id: facultySubjectAssignments.staff_account_id,
      subject_code: facultySubjectAssignments.subject_code,
      subject_name: facultySubjectAssignments.subject_name,
      course_semester: facultySubjectAssignments.course_semester,
      academic_term: facultySubjectAssignments.academic_term,
      academic_year: facultySubjectAssignments.academic_year,
      branch: facultySubjectAssignments.branch,
      faculty_name: staffAccounts.name,
      employee_id: staffAccounts.employee_id,
      faculty_email: staffAccounts.email,
      faculty_designation: staffAccounts.designation,
      is_active: facultySubjectAssignments.is_active,
      created_at: facultySubjectAssignments.created_at,
      subject_type: syllabusSubjects.subject_type
    })
    .from(facultySubjectAssignments)
    .innerJoin(staffAccounts, eq(facultySubjectAssignments.staff_account_id, staffAccounts.id))
    .leftJoin(syllabusSubjects, eq(facultySubjectAssignments.subject_code, syllabusSubjects.subject_code))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(
      desc(facultySubjectAssignments.is_active), 
      desc(facultySubjectAssignments.academic_year), 
      asc(facultySubjectAssignments.course_semester), 
      asc(facultySubjectAssignments.subject_name)
    );

    // 5. Query timetable slots count and attendance session count for evidence-based indicators
    const assignmentIds = assignments.map(a => a.id);
    let sessionCountMap = new Map();
    let timetableSlotMap = new Map();

    if (assignmentIds.length > 0) {
      try {
        const sessionCounts = await db.select({
          assignment_id: attendanceSessions.assignment_id,
          count: sql`COUNT(DISTINCT ${attendanceSessions.id})`.mapWith(Number)
        })
        .from(attendanceSessions)
        .where(inArray(attendanceSessions.assignment_id, assignmentIds))
        .groupBy(attendanceSessions.assignment_id);

        sessionCounts.forEach(s => sessionCountMap.set(s.assignment_id, s.count));

        const timetableCounts = await db.select({
          faculty_id: branchTimetable.faculty_id,
          subject_code: branchTimetable.subject_code,
          branch: branchTimetable.branch,
          semester: branchTimetable.semester,
          count: sql`COUNT(*)`.mapWith(Number)
        })
        .from(branchTimetable)
        .where(inArray(branchTimetable.subject_code, assignments.map(a => a.subject_code)))
        .groupBy(branchTimetable.faculty_id, branchTimetable.subject_code, branchTimetable.branch, branchTimetable.semester);

        timetableCounts.forEach(t => {
          const key = `${t.faculty_id}_${t.subject_code}_${t.branch}_${t.semester}`;
          timetableSlotMap.set(key, t.count);
        });
      } catch (_e) {
        // Non-fatal telemetry enrichment
      }
    }

    // 6. Enrich assignment objects with human-readable status, timetable readiness, and conducted sessions
    let enrichedAssignments = assignments.map(a => {
      const ttKey = `${a.faculty_id}_${a.subject_code}_${a.branch}_${a.course_semester}`;
      const weeklySlots = timetableSlotMap.get(ttKey) || 0;
      const conductedSessions = sessionCountMap.get(a.id) || 0;

      return {
        ...a,
        weekly_slots: weeklySlots,
        conducted_sessions: conductedSessions,
        status: a.is_active ? 'ACTIVE' : 'ARCHIVED',
        status_label: a.is_active ? 'Active' : 'Archived / Completed',
        is_timetable_ready: weeklySlots > 0
      };
    });

    // Apply client-friendly text search if requested
    if (searchQuery) {
      enrichedAssignments = enrichedAssignments.filter(a => 
        (a.subject_name?.toLowerCase().includes(searchQuery)) ||
        (a.subject_code?.toLowerCase().includes(searchQuery)) ||
        (a.faculty_name?.toLowerCase().includes(searchQuery)) ||
        (a.employee_id?.toLowerCase().includes(searchQuery)) ||
        (a.branch?.toLowerCase().includes(searchQuery))
      );
    }

    // 7. Optional Coverage Calculation: Compare syllabus subjects vs active assignments
    let coverage = null;
    if (includeCoverage && requestedBranch && requestedBranch !== 'all' && requestedSemester && requestedSemester !== 'all') {
      try {
        const semInt = Number(requestedSemester);
        const syllabusRows = await db.select({
          subject_code: syllabusStructure.subject_code,
          subject_name: syllabusSubjects.subject_name,
          subject_type: syllabusSubjects.subject_type,
          is_group: syllabusStructure.is_group,
          parent_group_code: syllabusStructure.parent_group_code
        })
        .from(syllabusStructure)
        .leftJoin(syllabusSubjects, eq(syllabusStructure.subject_code, syllabusSubjects.subject_code))
        .where(and(
          eq(syllabusStructure.branch, requestedBranch),
          eq(syllabusStructure.semester, semInt)
        ));

        // Group active assignments by subject_code
        const activeBySubject = new Map();
        enrichedAssignments.filter(a => a.is_active).forEach(a => {
          if (!activeBySubject.has(a.subject_code)) activeBySubject.set(a.subject_code, []);
          activeBySubject.get(a.subject_code).push(a);
        });

        const coveredSubjects = [];
        const unassignedSubjects = [];

        syllabusRows.forEach(s => {
          const matchingAssignments = activeBySubject.get(s.subject_code) || [];
          if (matchingAssignments.length > 0) {
            coveredSubjects.push({
              subject_code: s.subject_code,
              subject_name: s.subject_name || s.subject_code,
              subject_type: s.subject_type || 'theory',
              is_group: !!s.is_group,
              parent_group_code: s.parent_group_code,
              assigned_faculty: matchingAssignments.map(m => ({
                id: m.faculty_id,
                name: m.faculty_name,
                employee_id: m.employee_id,
                weekly_slots: m.weekly_slots
              }))
            });
          } else {
            unassignedSubjects.push({
              subject_code: s.subject_code,
              subject_name: s.subject_name || s.subject_code,
              subject_type: s.subject_type || 'theory',
              is_group: !!s.is_group,
              parent_group_code: s.parent_group_code,
              branch: requestedBranch,
              semester: semInt
            });
          }
        });

        const totalSyllabus = syllabusRows.length;
        const totalCovered = coveredSubjects.length;
        const pct = totalSyllabus > 0 ? Math.round((totalCovered / totalSyllabus) * 100) : 0;

        coverage = {
          total_syllabus_subjects: totalSyllabus,
          covered_subjects_count: totalCovered,
          unassigned_subjects_count: unassignedSubjects.length,
          coverage_percentage: pct,
          covered_subjects: coveredSubjects,
          unassigned_subjects: unassignedSubjects
        };
      } catch (err) {
        // Coverage non-fatal
      }
    }

    // 8. Resolve System Academic Year for reference
    const collegeRows = await db.select().from(collegeInfoTable).where(eq(collegeInfoTable.id, 1)).limit(1);
    const systemYear = (await getCollegeAcademicYear(collegeRows[0] || null)) || '2025-26';

    return apiResponse({ 
      data: enrichedAssignments,
      coverage,
      meta: {
        total_assignments: enrichedAssignments.length,
        active_assignments: enrichedAssignments.filter(a => a.is_active).length,
        archived_assignments: enrichedAssignments.filter(a => !a.is_active).length,
        system_year: systemYear,
        authorized_branches: authorizedBranches,
        is_coordinator: isCoord,
        is_hod: isHod
      }
    });
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

    const clientIp = (request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || '127.0.0.1').trim().slice(0, 45);
    const userAgent = (request.headers.get('user-agent') || 'system').slice(0, 500);

    if (attRows.length > 0 || marksRows.length > 0) {
      await db.update(facultySubjectAssignments).set({ is_active: false }).where(eq(facultySubjectAssignments.id, id));
      
      await db.insert(auditLogs).values({
        user_id: user.id,
        user_type: 'staff',
        action: user.is_first_year_coordinator ? 'COORDINATOR_DEACTIVATE_ASSIGNMENT' : 'HOD_DEACTIVATE_ASSIGNMENT',
        target_id: String(id),
        target_type: 'faculty_subject_assignments',
        payload_before: { id, branch, course_semester, academic_year, is_active: true },
        payload_after: { id, branch, course_semester, academic_year, is_active: false, reason: 'Preserved attendance and marks' },
        ip_address: clientIp,
        user_agent: userAgent
      });

      return apiResponse({ message: 'Subject assignment deactivated (attendance and evaluations preserved)' });
    }

    await db.delete(facultySubjectAssignments).where(eq(facultySubjectAssignments.id, id));

    await db.insert(auditLogs).values({
      user_id: user.id,
      user_type: 'staff',
      action: user.is_first_year_coordinator ? 'COORDINATOR_DELETE_ASSIGNMENT' : 'HOD_DELETE_ASSIGNMENT',
      target_id: String(id),
      target_type: 'faculty_subject_assignments',
      payload_before: { id, branch, course_semester, academic_year, is_active: true },
      payload_after: { id, deleted: true },
      ip_address: clientIp,
      user_agent: userAgent
    });

    return apiResponse({ message: 'Subject assignment removed successfully' });
  }
});


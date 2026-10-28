import { db } from '@/db';
import { 
  facultySubjectAssignments, 
  facultySubjectInterests,
  syllabusStructure,
  syllabusSubjects,
  timetableInstances,
  branchTimetable,
  collegeInfo as collegeInfoTable
} from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { apiResponse, apiError, wrapHandler } from '@/lib/api-utils';
import { getCollegeAcademicYear } from '@/lib/academic-utils';
import { 
  isAcademicScopeAllowed,
  getAuthorizedAcademicBranches,
  getAllowedAcademicSemesters,
  getInstitutionalBranches
} from '@/lib/academic-authorization';

export const GET = wrapHandler({
  auth: ['hod', 'first_year_coordinator', 'faculty'],
  handler: async (request, { user }) => {
    const isHod = !!user.is_hod;
    const isCoord = !!user.is_first_year_coordinator;
    const isAdmin = user.role === 'admin' || !!user.is_principal;

    if (!isHod && !isCoord && !isAdmin) {
      return apiError('Unauthorized - HOD or First Year Coordinator role required', 403);
    }

    const { searchParams } = new URL(request.url);
    const requestedBranch = searchParams.get('branch');
    const requestedSemester = searchParams.get('semester');
    const requestedYear = searchParams.get('academic_year');

    // Resolve Academic Year
    const collegeRows = await db.select().from(collegeInfoTable).where(eq(collegeInfoTable.id, 1)).limit(1);
    const currentAcademicYear = (await getCollegeAcademicYear(collegeRows[0] || null)) || '2025-26';
    const academicYear = requestedYear || currentAcademicYear;

    // Resolve Branch & Semester
    const authorizedBranches = getAuthorizedAcademicBranches(user) || (await getInstitutionalBranches());
    const targetBranch = requestedBranch || (authorizedBranches.length > 0 ? authorizedBranches[0] : 'CSE');

    if (!isAdmin && !isCoord && authorizedBranches.length > 0 && !authorizedBranches.includes(targetBranch)) {
      return apiError(`Forbidden - Not authorized for ${targetBranch} branch.`, 403);
    }

    const allowedSemesters = getAllowedAcademicSemesters(user, targetBranch);
    const semInt = requestedSemester ? Number(requestedSemester) : (allowedSemesters.length > 0 ? allowedSemesters[0] : 1);

    if (requestedSemester && !isAcademicScopeAllowed(user, { branch: targetBranch, semester: semInt })) {
      return apiError(`Forbidden - Not authorized for ${targetBranch} Semester ${semInt}.`, 403);
    }

    // 1. Syllabus Catalogue Check
    const syllabusItems = await db.select({
      subject_code: syllabusStructure.subject_code,
      subject_name: syllabusSubjects.subject_name
    })
    .from(syllabusStructure)
    .leftJoin(syllabusSubjects, eq(syllabusStructure.subject_code, syllabusSubjects.subject_code))
    .where(and(
      eq(syllabusStructure.branch, targetBranch),
      eq(syllabusStructure.semester, semInt)
    ));

    const totalSubjects = syllabusItems.length;
    const syllabusStatus = totalSubjects > 0 ? 'READY' : 'ACTION_REQUIRED';
    const syllabusMessage = totalSubjects > 0 
      ? `Syllabus configured with ${totalSubjects} subject offerings.`
      : `No subjects configured in syllabus for ${targetBranch} Sem ${semInt}.`;

    // 2. Faculty Allocation Check
    const assignments = await db.select({
      id: facultySubjectAssignments.id,
      subject_code: facultySubjectAssignments.subject_code
    })
    .from(facultySubjectAssignments)
    .where(and(
      eq(facultySubjectAssignments.branch, targetBranch),
      eq(facultySubjectAssignments.course_semester, semInt),
      eq(facultySubjectAssignments.academic_year, academicYear),
      eq(facultySubjectAssignments.is_active, true)
    ));

    const assignedCodes = new Set(assignments.map(a => a.subject_code));
    const unassignedCodes = syllabusItems.filter(s => !assignedCodes.has(s.subject_code));
    
    let allocationStatus = 'READY';
    let allocationMessage = 'All subjects have assigned faculty.';
    if (totalSubjects === 0) {
      allocationStatus = 'NOT_CONFIGURED';
      allocationMessage = 'Requires syllabus configuration before allocations.';
    } else if (unassignedCodes.length > 0) {
      allocationStatus = 'ACTION_REQUIRED';
      allocationMessage = `${unassignedCodes.length} of ${totalSubjects} subjects require faculty allocation.`;
    }

    // 3. Timetable Instance & Slot Check
    const ttInstances = await db.select({
      id: timetableInstances.id,
      status: timetableInstances.status
    })
    .from(timetableInstances)
    .where(and(
      eq(timetableInstances.branch, targetBranch),
      eq(timetableInstances.semester, semInt),
      eq(timetableInstances.academic_year, academicYear)
    ))
    .limit(1);

    const timetableSlots = await db.select({
      count: sql`COUNT(*)`.mapWith(Number)
    })
    .from(branchTimetable)
    .where(and(
      eq(branchTimetable.branch, targetBranch),
      eq(branchTimetable.semester, semInt),
      eq(branchTimetable.academic_year, academicYear)
    ));

    const slotCount = timetableSlots[0]?.count || 0;
    const instance = ttInstances[0] || null;

    let timetableStatus = 'READY';
    let timetableMessage = 'Timetable published and scheduled.';
    if (!instance) {
      timetableStatus = 'ACTION_REQUIRED';
      timetableMessage = `Timetable instance not yet created for ${academicYear}.`;
    } else if (instance.status === 'DRAFT') {
      timetableStatus = slotCount > 0 ? 'WARNING' : 'ACTION_REQUIRED';
      timetableMessage = slotCount > 0 
        ? `Timetable is in DRAFT with ${slotCount} slots. Requires review and publishing.`
        : 'Timetable is in DRAFT and has 0 scheduled periods.';
    } else if (slotCount === 0) {
      timetableStatus = 'ACTION_REQUIRED';
      timetableMessage = 'Timetable published but has 0 scheduled class slots.';
    }

    // 4. Pending Requests Check
    const pendingInterests = await db.select({
      count: sql`COUNT(*)`.mapWith(Number)
    })
    .from(facultySubjectInterests)
    .where(and(
      eq(facultySubjectInterests.branch, targetBranch),
      eq(facultySubjectInterests.semester, semInt),
      eq(facultySubjectInterests.academic_year, academicYear),
      eq(facultySubjectInterests.status, 'PENDING')
    ));

    const pendingCount = pendingInterests[0]?.count || 0;
    const requestStatus = pendingCount === 0 ? 'READY' : 'ACTION_REQUIRED';
    const requestMessage = pendingCount === 0 
      ? 'All faculty subject preference requests reviewed.'
      : `${pendingCount} pending subject preference request(s) awaiting approval.`;

    // Calculate Overall Readiness Score (0 to 100%)
    let points = 0;
    if (syllabusStatus === 'READY') points += 25;
    if (allocationStatus === 'READY') points += 35;
    else if (allocationStatus === 'ACTION_REQUIRED' && totalSubjects > 0) {
      const coveredFraction = (totalSubjects - unassignedCodes.length) / totalSubjects;
      points += Math.round(coveredFraction * 35);
    }
    if (timetableStatus === 'READY') points += 25;
    else if (timetableStatus === 'WARNING') points += 15;
    if (requestStatus === 'READY') points += 15;

    const checklistItems = [
      {
        id: 'syllabus',
        title: 'Curriculum & Syllabus Structure',
        status: syllabusStatus,
        message: syllabusMessage,
        details: { total_subjects: totalSubjects }
      },
      {
        id: 'allocations',
        title: 'Faculty Teaching Allocations',
        status: allocationStatus,
        message: allocationMessage,
        details: { 
          total: totalSubjects, 
          assigned: totalSubjects - unassignedCodes.length,
          unassigned: unassignedCodes.map(u => ({ code: u.subject_code, name: u.subject_name }))
        }
      },
      {
        id: 'timetable',
        title: 'Timetable Schedule & Publishing',
        status: timetableStatus,
        message: timetableMessage,
        details: { 
          instance_status: instance?.status || 'NOT_CREATED',
          scheduled_slots: slotCount 
        }
      },
      {
        id: 'requests',
        title: 'Faculty Subject Requests Clearance',
        status: requestStatus,
        message: requestMessage,
        details: { pending_requests_count: pendingCount }
      }
    ];

    return apiResponse({
      data: {
        academic_year: academicYear,
        branch: targetBranch,
        semester: semInt,
        readiness_score: Math.min(100, Math.max(0, points)),
        is_ready: points >= 90 && unassignedCodes.length === 0,
        checklist: checklistItems,
        authorized_branches: authorizedBranches,
        allowed_semesters: allowedSemesters
      }
    });
  }
});

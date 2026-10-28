import { db } from '@/db';
import { 
  facultySubjectAssignments, 
  facultySubjectInterests,
  staffAccounts, 
  syllabusStructure,
  syllabusSubjects,
  branchTimetable,
  collegeInfo as collegeInfoTable
} from '@/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
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

    // 1. Resolve Academic Year
    const collegeRows = await db.select().from(collegeInfoTable).where(eq(collegeInfoTable.id, 1)).limit(1);
    const currentAcademicYear = (await getCollegeAcademicYear(collegeRows[0] || null)) || '2025-26';
    const academicYear = requestedYear || currentAcademicYear;

    // 2. Resolve Authorized Branches
    const authorizedBranches = getAuthorizedAcademicBranches(user) || (await getInstitutionalBranches());
    const targetBranch = requestedBranch || (authorizedBranches.length > 0 ? authorizedBranches[0] : 'CSE');

    // Scope check on branch
    if (!isAdmin && !isCoord && authorizedBranches.length > 0 && !authorizedBranches.includes(targetBranch)) {
      return apiError(`Forbidden - Not authorized for ${targetBranch} branch.`, 403);
    }

    // 3. Resolve Semesters
    const allowedSemesters = getAllowedAcademicSemesters(user, targetBranch);
    const semInt = requestedSemester ? Number(requestedSemester) : (allowedSemesters.length > 0 ? allowedSemesters[0] : 1);

    if (requestedSemester && !isAcademicScopeAllowed(user, { branch: targetBranch, semester: semInt })) {
      return apiError(`Forbidden - Not authorized for ${targetBranch} Semester ${semInt}.`, 403);
    }

    // 4. Query Syllabus Subjects for targetBranch and semester
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
      eq(syllabusStructure.branch, targetBranch),
      eq(syllabusStructure.semester, semInt)
    ));

    // 5. Query Active Teaching Assignments in this branch, semester, and academic year
    const activeAssignments = await db.select({
      id: facultySubjectAssignments.id,
      faculty_id: facultySubjectAssignments.staff_account_id,
      faculty_name: staffAccounts.name,
      employee_id: staffAccounts.employee_id,
      faculty_email: staffAccounts.email,
      faculty_designation: staffAccounts.designation,
      subject_code: facultySubjectAssignments.subject_code,
      subject_name: facultySubjectAssignments.subject_name,
      created_at: facultySubjectAssignments.created_at
    })
    .from(facultySubjectAssignments)
    .innerJoin(staffAccounts, eq(facultySubjectAssignments.staff_account_id, staffAccounts.id))
    .where(and(
      eq(facultySubjectAssignments.branch, targetBranch),
      eq(facultySubjectAssignments.course_semester, semInt),
      eq(facultySubjectAssignments.academic_year, academicYear),
      eq(facultySubjectAssignments.is_active, true)
    ));

    // 6. Query Pending Requests for this branch and semester
    const pendingInterests = await db.select({
      id: facultySubjectInterests.id,
      faculty_id: facultySubjectInterests.staff_account_id,
      faculty_name: staffAccounts.name,
      subject_code: facultySubjectInterests.subject_code,
      subject_name: facultySubjectInterests.subject_name,
      created_at: facultySubjectInterests.created_at
    })
    .from(facultySubjectInterests)
    .innerJoin(staffAccounts, eq(facultySubjectInterests.staff_account_id, staffAccounts.id))
    .where(and(
      eq(facultySubjectInterests.branch, targetBranch),
      eq(facultySubjectInterests.semester, semInt),
      eq(facultySubjectInterests.academic_year, academicYear),
      eq(facultySubjectInterests.status, 'PENDING')
    ));

    // 7. Query Timetable Slots for scheduled readiness
    let timetableSlots = [];
    try {
      timetableSlots = await db.select({
        day_of_week: branchTimetable.day_of_week,
        period_number: branchTimetable.period_number,
        subject_code: branchTimetable.subject_code,
        faculty_id: branchTimetable.faculty_id
      })
      .from(branchTimetable)
      .where(and(
        eq(branchTimetable.branch, targetBranch),
        eq(branchTimetable.semester, semInt),
        eq(branchTimetable.academic_year, academicYear)
      ));
    } catch (_e) {
      // Non-fatal
    }

    // 8. Map Syllabus Subjects to Assignments & Timetable Slots
    const assignmentsBySubject = new Map();
    activeAssignments.forEach(a => {
      if (!assignmentsBySubject.has(a.subject_code)) assignmentsBySubject.set(a.subject_code, []);
      assignmentsBySubject.get(a.subject_code).push(a);
    });

    const slotsBySubject = new Map();
    timetableSlots.forEach(s => {
      if (s.subject_code) {
        slotsBySubject.set(s.subject_code, (slotsBySubject.get(s.subject_code) || 0) + 1);
      }
    });

    const coveredSubjects = [];
    const unassignedSubjects = [];
    const actionableAlerts = [];

    syllabusRows.forEach(sub => {
      const assignedFaculty = assignmentsBySubject.get(sub.subject_code) || [];
      const scheduledSlots = slotsBySubject.get(sub.subject_code) || 0;

      if (assignedFaculty.length > 0) {
        coveredSubjects.push({
          subject_code: sub.subject_code,
          subject_name: sub.subject_name || sub.subject_code,
          subject_type: sub.subject_type || 'theory',
          is_group: !!sub.is_group,
          parent_group_code: sub.parent_group_code,
          assigned_faculty: assignedFaculty,
          scheduled_periods: scheduledSlots,
          is_multi_instructor: assignedFaculty.length > 1
        });

        if (scheduledSlots === 0) {
          actionableAlerts.push({
            type: 'TIMETABLE_NOT_SCHEDULED',
            severity: 'WARNING',
            message: `Subject ${sub.subject_name || sub.subject_code} (${sub.subject_code}) is assigned but has 0 timetable periods scheduled.`,
            subject_code: sub.subject_code
          });
        }
      } else {
        unassignedSubjects.push({
          subject_code: sub.subject_code,
          subject_name: sub.subject_name || sub.subject_code,
          subject_type: sub.subject_type || 'theory',
          is_group: !!sub.is_group,
          parent_group_code: sub.parent_group_code,
          branch: targetBranch,
          semester: semInt
        });

        actionableAlerts.push({
          type: 'UNASSIGNED_SUBJECT',
          severity: 'HIGH',
          message: `Missing faculty coverage: ${sub.subject_name || sub.subject_code} (${sub.subject_code}) has no teaching faculty assigned.`,
          subject_code: sub.subject_code
        });
      }
    });

    if (pendingInterests.length > 0) {
      actionableAlerts.push({
        type: 'PENDING_ALLOCATION_REQUESTS',
        severity: 'INFO',
        message: `${pendingInterests.length} faculty teaching preference request(s) awaiting approval in ${targetBranch} Sem ${semInt}.`,
        count: pendingInterests.length
      });
    }

    // 9. Workload Distribution: Teaching Load across assigned faculty
    const facultyWorkloadMap = new Map();
    activeAssignments.forEach(a => {
      if (!facultyWorkloadMap.has(a.faculty_id)) {
        facultyWorkloadMap.set(a.faculty_id, {
          id: a.faculty_id,
          name: a.faculty_name,
          employee_id: a.employee_id,
          email: a.faculty_email,
          designation: a.faculty_designation,
          assigned_subjects: [],
          total_periods: 0
        });
      }
      const entry = facultyWorkloadMap.get(a.faculty_id);
      entry.assigned_subjects.push({
        subject_code: a.subject_code,
        subject_name: a.subject_name
      });
    });

    timetableSlots.forEach(s => {
      if (s.faculty_id && facultyWorkloadMap.has(s.faculty_id)) {
        facultyWorkloadMap.get(s.faculty_id).total_periods += 1;
      }
    });

    const workloadList = Array.from(facultyWorkloadMap.values()).sort((a, b) => b.total_periods - a.total_periods);

    const totalSyllabus = syllabusRows.length;
    const totalCovered = coveredSubjects.length;
    const coveragePercentage = totalSyllabus > 0 ? Math.round((totalCovered / totalSyllabus) * 100) : 0;

    return apiResponse({
      data: {
        academic_year: academicYear,
        branch: targetBranch,
        semester: semInt,
        summary: {
          total_syllabus_subjects: totalSyllabus,
          covered_subjects_count: totalCovered,
          unassigned_subjects_count: unassignedSubjects.length,
          coverage_percentage: coveragePercentage,
          total_assignments: activeAssignments.length,
          distinct_assigned_faculty: facultyWorkloadMap.size,
          pending_requests_count: pendingInterests.length,
          total_timetable_slots: timetableSlots.length
        },
        covered_subjects: coveredSubjects,
        unassigned_subjects: unassignedSubjects,
        pending_requests: pendingInterests,
        workload_distribution: workloadList,
        alerts: actionableAlerts,
        authorized_branches: authorizedBranches,
        allowed_semesters: allowedSemesters
      }
    });
  }
});

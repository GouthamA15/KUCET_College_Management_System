import { NextResponse } from 'next/server';
import { db } from '@/db';
import { 
  facultySubjectAssignments, 
  staffAccounts, 
  syllabusStructure,
  syllabusSubjects,
  collegeInfo as collegeInfoTable
} from '@/db/schema';
import { eq, and, desc, asc, inArray } from 'drizzle-orm';
import { apiError, getAuthUser } from '@/lib/api-utils';
import { getCollegeAcademicYear } from '@/lib/academic-utils';
import { 
  isAcademicScopeAllowed, 
  getAuthorizedAcademicBranches,
  getInstitutionalBranches
} from '@/lib/academic-authorization';
import logger from '@/lib/logger';

function escapeCSV(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val).replace(/[\r\n]+/g, ' ').trim();
  // Prevent CSV Formula Injection: neutralize spreadsheet execution triggers
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  if (str.includes(',') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

export async function GET(request) {
  try {
    const user = await getAuthUser(['hod', 'first_year_coordinator', 'faculty']);
    if (!user) return apiError('Unauthorized', 401);

    const isHod = !!user.is_hod;
    const isCoord = !!user.is_first_year_coordinator;
    const isAdmin = user.role === 'admin' || !!user.is_principal;

    if (!isHod && !isCoord && !isAdmin) {
      return apiError('Unauthorized - HOD or First Year Coordinator required', 403);
    }

    const { searchParams } = new URL(request.url);
    const exportType = searchParams.get('type') || 'assignments'; // 'assignments', 'coverage', 'workload'
    const requestedBranch = searchParams.get('branch');
    const requestedSemester = searchParams.get('semester');
    const requestedYear = searchParams.get('academic_year');
    const requestedStatus = searchParams.get('status') || 'all';

    // 1. Resolve Academic Year
    const collegeRows = await db.select().from(collegeInfoTable).where(eq(collegeInfoTable.id, 1)).limit(1);
    const systemYear = (await getCollegeAcademicYear(collegeRows[0] || null)) || '2025-26';
    const academicYear = requestedYear || systemYear;

    // 2. Validate Branch Authorization
    const authorizedBranches = getAuthorizedAcademicBranches(user) || (await getInstitutionalBranches());
    if (!isAdmin && requestedBranch && requestedBranch !== 'all' && !isCoord && !authorizedBranches.includes(requestedBranch)) {
      return apiError(`Forbidden - Not authorized for ${requestedBranch} branch.`, 403);
    }

    // 3. Validate Semester Authorization
    if (requestedSemester && requestedSemester !== 'all') {
      const semInt = Number(requestedSemester);
      if (isCoord && !isHod && !isAdmin && (semInt < 1 || semInt > 2)) {
        return apiError('Forbidden - Coordinator scope restricted to Semesters 1 and 2.', 403);
      }
      if (requestedBranch && requestedBranch !== 'all' && !isAcademicScopeAllowed(user, { branch: requestedBranch, semester: semInt })) {
        return apiError(`Forbidden - Not authorized for ${requestedBranch} Semester ${semInt}.`, 403);
      }
    }

    // 4. Branch and Scope Conditions
    const conditions = [];
    if (isCoord && !isHod && !isAdmin) {
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
      if (requestedBranch && requestedBranch !== 'all') {
        conditions.push(eq(facultySubjectAssignments.branch, requestedBranch));
      }
      if (requestedSemester && requestedSemester !== 'all') {
        conditions.push(eq(facultySubjectAssignments.course_semester, Number(requestedSemester)));
      }
    }

    if (academicYear && academicYear !== 'all') {
      conditions.push(eq(facultySubjectAssignments.academic_year, academicYear));
    }

    const statusCondition = requestedStatus === 'active' 
      ? eq(facultySubjectAssignments.is_active, true) 
      : (requestedStatus === 'archived' ? eq(facultySubjectAssignments.is_active, false) : null);

    const csvRows = [];
    let filename = '';

    if (exportType === 'coverage' && requestedBranch && requestedBranch !== 'all' && requestedSemester && requestedSemester !== 'all') {
      // ─── COVERAGE REPORT ───
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

      const activeAssignments = await db.select({
        subject_code: facultySubjectAssignments.subject_code,
        faculty_name: staffAccounts.name,
        employee_id: staffAccounts.employee_id
      })
      .from(facultySubjectAssignments)
      .innerJoin(staffAccounts, eq(facultySubjectAssignments.staff_account_id, staffAccounts.id))
      .where(and(
        eq(facultySubjectAssignments.branch, requestedBranch),
        eq(facultySubjectAssignments.course_semester, semInt),
        eq(facultySubjectAssignments.academic_year, academicYear),
        eq(facultySubjectAssignments.is_active, true)
      ));

      const assignMap = new Map();
      activeAssignments.forEach(a => {
        if (!assignMap.has(a.subject_code)) assignMap.set(a.subject_code, []);
        assignMap.get(a.subject_code).push(`${a.faculty_name} (${a.employee_id})`);
      });

      csvRows.push(['#', 'Subject Code', 'Subject Title', 'Type', 'Branch', 'Semester', 'Academic Year', 'Coverage Status', 'Assigned Faculty'].map(escapeCSV).join(','));

      syllabusRows.forEach((s, idx) => {
        const assigned = assignMap.get(s.subject_code) || [];
        const isCovered = assigned.length > 0;
        csvRows.push([
          idx + 1,
          s.subject_code,
          s.subject_name || s.subject_code,
          s.subject_type || (s.is_group ? 'Elective' : 'Theory'),
          requestedBranch,
          semInt,
          academicYear,
          isCovered ? (assigned.length > 1 ? 'MULTI_INSTRUCTOR' : 'COVERED') : 'UNASSIGNED',
          assigned.join('; ') || 'NONE'
        ].map(escapeCSV).join(','));
      });

      filename = `academic_coverage_${requestedBranch}_Sem${semInt}_${academicYear}.csv`;

    } else if (exportType === 'workload') {
      // ─── WORKLOAD REPORT ───
      const assignments = await db.select({
        faculty_id: facultySubjectAssignments.staff_account_id,
        faculty_name: staffAccounts.name,
        employee_id: staffAccounts.employee_id,
        designation: staffAccounts.designation,
        subject_code: facultySubjectAssignments.subject_code,
        subject_name: facultySubjectAssignments.subject_name,
        branch: facultySubjectAssignments.branch,
        course_semester: facultySubjectAssignments.course_semester
      })
      .from(facultySubjectAssignments)
      .innerJoin(staffAccounts, eq(facultySubjectAssignments.staff_account_id, staffAccounts.id))
      .where(and(...conditions, eq(facultySubjectAssignments.is_active, true)));

      // Group by faculty
      const facultyMap = new Map();
      assignments.forEach(a => {
        if (!facultyMap.has(a.faculty_id)) {
          facultyMap.set(a.faculty_id, {
            name: a.faculty_name,
            employee_id: a.employee_id,
            designation: a.designation || 'Faculty',
            subjects: []
          });
        }
        facultyMap.get(a.faculty_id).subjects.push(`${a.subject_code} (${a.branch} S${a.course_semester})`);
      });

      csvRows.push(['#', 'Employee ID', 'Faculty Name', 'Designation', 'Total Active Subjects', 'Assigned Courses', 'Academic Year'].map(escapeCSV).join(','));

      let rowNum = 1;
      facultyMap.forEach(f => {
        csvRows.push([
          rowNum++,
          f.employee_id,
          f.name,
          f.designation,
          f.subjects.length,
          f.subjects.join('; '),
          academicYear
        ].map(escapeCSV).join(','));
      });

      filename = `faculty_workload_summary_${academicYear}.csv`;

    } else {
      // ─── TEACHING ASSIGNMENTS DIRECTORY REPORT ───
      const directoryConditions = statusCondition ? [...conditions, statusCondition] : conditions;
      const assignments = await db.select({
        id: facultySubjectAssignments.id,
        faculty_id: facultySubjectAssignments.staff_account_id,
        faculty_name: staffAccounts.name,
        employee_id: staffAccounts.employee_id,
        designation: staffAccounts.designation,
        subject_code: facultySubjectAssignments.subject_code,
        subject_name: facultySubjectAssignments.subject_name,
        branch: facultySubjectAssignments.branch,
        course_semester: facultySubjectAssignments.course_semester,
        academic_year: facultySubjectAssignments.academic_year,
        is_active: facultySubjectAssignments.is_active,
        created_at: facultySubjectAssignments.created_at,
        subject_type: syllabusSubjects.subject_type
      })
      .from(facultySubjectAssignments)
      .innerJoin(staffAccounts, eq(facultySubjectAssignments.staff_account_id, staffAccounts.id))
      .leftJoin(syllabusSubjects, eq(facultySubjectAssignments.subject_code, syllabusSubjects.subject_code))
      .where(directoryConditions.length > 0 ? and(...directoryConditions) : undefined)
      .orderBy(
        desc(facultySubjectAssignments.is_active),
        asc(facultySubjectAssignments.branch),
        asc(facultySubjectAssignments.course_semester),
        asc(facultySubjectAssignments.subject_name)
      );

      csvRows.push([
        '#',
        'Academic Year',
        'Branch',
        'Semester',
        'Subject Code',
        'Subject Title',
        'Type',
        'Faculty Name',
        'Employee ID',
        'Designation',
        'Assignment Status',
        'Created Date'
      ].map(escapeCSV).join(','));

      assignments.forEach((a, idx) => {
        csvRows.push([
          idx + 1,
          a.academic_year,
          a.branch,
          `Sem ${a.course_semester}`,
          a.subject_code,
          a.subject_name,
          a.subject_type || 'theory',
          a.faculty_name,
          a.employee_id,
          a.designation || 'Faculty',
          a.is_active ? 'ACTIVE' : 'ARCHIVED',
          a.created_at ? new Date(a.created_at).toISOString().split('T')[0] : 'N/A'
        ].map(escapeCSV).join(','));
      });

      filename = `teaching_assignments_${requestedBranch || 'all'}_${academicYear}.csv`;
    }

    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (err) {
    logger.error({ err: err.message }, '[EXPORT_SUBJECT_ASSIGNMENTS_ERROR]');
    return apiError('Failed to generate export file', 500);
  }
}

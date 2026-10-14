import { db } from '@/db';
import { 
  facultySubjectAssignments, 
  staffAccounts,
  staffAccountRoles,
  staffRoles,
  collegeInfo as collegeInfoTable,
  syllabusStructure
} from '@/db/schema';
import { eq, and, asc, desc, inArray } from 'drizzle-orm';
import { apiResponse, apiError, wrapHandler } from '@/lib/api-utils';
import { getCollegeAcademicYear } from '@/lib/academic-utils';

export const GET = wrapHandler({
  auth: 'hod',
  handler: async (_request, { user }) => {
    const authorizedBranches = user.authorized_branches || (user.branch ? [user.branch] : []);
    const requestedBranch = _request.nextUrl?.searchParams?.get('branch');

    if (user.role !== 'admin' && requestedBranch && authorizedBranches.length > 0 && !authorizedBranches.includes(requestedBranch)) {
      return apiError(`Forbidden - Not authorized for ${requestedBranch} branch.`, 403);
    }

    const branchFilter = requestedBranch 
      ? [requestedBranch] 
      : (authorizedBranches.length > 0 ? authorizedBranches : (user.branch ? [user.branch] : []));

    const conditions = [];
    if (user.role !== 'admin' && branchFilter.length > 0) {
      conditions.push(inArray(facultySubjectAssignments.branch, branchFilter));
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
    .where(and(...conditions))
    .orderBy(desc(facultySubjectAssignments.is_active), desc(facultySubjectAssignments.course_semester), asc(facultySubjectAssignments.subject_name));

    return apiResponse({ data: assignments });
  }
});

export const POST = wrapHandler({
  auth: 'hod',
  handler: async (request, { user }) => {
    const body = await request.json();
    const { 
      faculty_id, 
      subject_code, 
      subject_name, 
      branch, 
      semester, 
      academic_year 
    } = body;

    if (!subject_code || !subject_name || !branch || !semester) {
      return apiError('Missing required fields: subject_code, subject_name, branch, semester are required.', 400);
    }
    
    if (academic_year && !academic_year.match(/^\d{4}-\d{2}$/)) {
      return apiError('Invalid academic_year format. Expected YYYY-YY', 400);
    }

    const authorizedBranches = user.authorized_branches || (user.branch ? [user.branch] : []);
    if (user.role !== 'admin' && authorizedBranches.length > 0 && !authorizedBranches.includes(branch)) {
      return apiError(`Unauthorized: You are not authorized to assign subjects for ${branch} branch.`, 403);
    }

    const collegeRows = await db.select().from(collegeInfoTable).where(eq(collegeInfoTable.id, 1)).limit(1);
    const collegeInfo = collegeRows[0] || null;
    const currentAcademicYear = await getCollegeAcademicYear(collegeInfo);

    // Validate subject exists in the specified branch
    const subjectCheck = await db.select({ subject_code: syllabusStructure.subject_code })
      .from(syllabusStructure)
      .where(and(
        eq(syllabusStructure.subject_code, subject_code),
        eq(syllabusStructure.branch, branch)
      ))
      .limit(1);

    if (subjectCheck.length === 0) {
      return apiError('Subject does not exist in the specified branch syllabus.', 400);
    }

    const target_faculty_id = faculty_id || user.id;
    const resolvedAcademicYear = academic_year || currentAcademicYear || '2025-26';
    const parsedSemester = parseInt(semester);

    // Verify target faculty is an active faculty member (can teach across any branch/year)
    const facultyCheck = await db.select({ id: staffAccounts.id })
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

    // Duplicate Check
    const existingAssignment = await db.select({ id: facultySubjectAssignments.id, is_active: facultySubjectAssignments.is_active })
      .from(facultySubjectAssignments)
      .where(and(
        eq(facultySubjectAssignments.staff_account_id, target_faculty_id),
        eq(facultySubjectAssignments.subject_code, subject_code),
        eq(facultySubjectAssignments.branch, branch),
        eq(facultySubjectAssignments.course_semester, parsedSemester),
        eq(facultySubjectAssignments.academic_year, resolvedAcademicYear)
      ))
      .limit(1);

    if (existingAssignment.length > 0) {
      if (existingAssignment[0].is_active) {
        return apiError('This instructor is already assigned to this subject for this semester.', 409);
      } else {
        // Reactivate
        await db.update(facultySubjectAssignments)
          .set({ is_active: true })
          .where(eq(facultySubjectAssignments.id, existingAssignment[0].id));
        return apiResponse({ message: 'Subject assignment reactivated successfully' });
      }
    }

    await db.insert(facultySubjectAssignments).values({
      staff_account_id: target_faculty_id,
      subject_code: subject_code,
      subject_name: subject_name,
      branch: branch,
      course_semester: parsedSemester,
      academic_term: (parsedSemester % 2 === 0 ? 2 : 1),
      academic_year: resolvedAcademicYear,
      is_active: true
    });

    return apiResponse({ message: 'Subject assigned successfully' });
  }
});

export const DELETE = wrapHandler({
  auth: 'hod',
  handler: async (request, { user }) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null;

    if (!id) return apiError('Missing assignment ID', 400);

    // Verify the assignment exists and belongs to HOD's authorized branch
    const assignmentCheck = await db.select({ 
      id: facultySubjectAssignments.id,
      branch: facultySubjectAssignments.branch
    })
    .from(facultySubjectAssignments)
    .where(eq(facultySubjectAssignments.id, id))
    .limit(1);

    if (assignmentCheck.length === 0) {
      return apiError('Assignment not found.', 404);
    }

    const authorizedBranches = user.authorized_branches || (user.branch ? [user.branch] : []);
    if (user.role !== 'admin' && authorizedBranches.length > 0 && !authorizedBranches.includes(assignmentCheck[0].branch)) {
      return apiError(`Unauthorized: Assignment belongs to ${assignmentCheck[0].branch} branch which is outside your authorized scope.`, 403);
    }

    await db.delete(facultySubjectAssignments).where(eq(facultySubjectAssignments.id, id));

    return apiResponse({ message: 'Subject assignment removed successfully' });
  }
});

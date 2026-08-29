import { db } from '@/db';
import { 
  facultySubjectAssignments, 
  staffAccounts,
  staffAccountRoles,
  staffRoles,
  facultyHodAssignments,
  collegeInfo as collegeInfoTable,
  staffAcademicAffiliations,
  academicDepartments
} from '@/db/schema';
import { eq, and, asc, desc, sql, inArray } from 'drizzle-orm';
import { apiResponse, apiError, wrapHandler } from '@/lib/api-utils';
import { getCollegeAcademicYear } from '@/lib/academic-utils';

export const GET = wrapHandler({
  auth: 'hod',
  handler: async (_request, { user }) => {
    if (!user.hod_department_code) {
      return apiError('Unauthorized - Active HOD Assignment Required', 403);
    }

    // 1. Fetch eligible Faculty Staff IDs in the HOD's department
    const eligibleFaculty = await db.select({
      staff_id: staffAccounts.id
    })
    .from(staffAccounts)
    .innerJoin(staffAccountRoles, eq(staffAccountRoles.staff_account_id, staffAccounts.id))
    .innerJoin(staffRoles, eq(staffAccountRoles.role_id, staffRoles.id))
    .innerJoin(staffAcademicAffiliations, eq(staffAcademicAffiliations.staff_account_id, staffAccounts.id))
    .innerJoin(academicDepartments, eq(staffAcademicAffiliations.department_id, academicDepartments.id))
    .where(and(
      eq(staffRoles.role_code, 'FACULTY'),
      eq(academicDepartments.department_code, user.hod_department_code)
    ));

    const eligibleStaffIds = [...new Set(eligibleFaculty.map(f => f.staff_id))];

    if (eligibleStaffIds.length === 0) {
      return apiResponse({ data: [] });
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
    .where(inArray(facultySubjectAssignments.staff_account_id, eligibleStaffIds))
    .orderBy(desc(facultySubjectAssignments.is_active), desc(facultySubjectAssignments.course_semester), asc(facultySubjectAssignments.subject_name));

    return apiResponse({ data: assignments });
  }
});

export const POST = wrapHandler({
  auth: 'hod',
  handler: async (request, { user }) => {
    const { subject_code, subject_name, branch, semester, academic_year } = await request.json();

    if (!subject_code || !semester || !branch) {
      return apiError('Missing required fields', 400);
    }
    
    if (academic_year && !academic_year.match(/^\d{4}-\d{2}$/)) {
      return apiError('Invalid academic_year format. Expected YYYY-YY', 400);
    }

    const collegeRows = await db.select().from(collegeInfoTable).where(eq(collegeInfoTable.id, 1)).limit(1);
    const collegeInfo = collegeRows[0] || null;
    const currentAcademicYear = await getCollegeAcademicYear(collegeInfo);

    if (!user.hod_department_code) {
      return apiError('Unauthorized - Active HOD Assignment Required', 403);
    }

    const { syllabusStructure } = await import('@/db/schema');

    // Validate subject exists in the specified branch
    const subjectCheck = await db.select({ subject_code: syllabusStructure.subject_code })
      .from(syllabusStructure)
      .where(and(
        eq(syllabusStructure.subject_code, subject_code),
        eq(syllabusStructure.branch, branch)
      ))
      .limit(1);

    if (subjectCheck.length === 0) {
      return apiError('Subject does not exist in the specified branch.', 400);
    }

    // Force self-assignment for HOD
    const target_faculty_id = user.id;
    const resolvedAcademicYear = academic_year || currentAcademicYear || '2025-26';
    const parsedSemester = parseInt(semester);

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
        return apiError('You are already assigned to this subject for this semester.', 409);
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

    const collegeRows = await db.select().from(collegeInfoTable).where(eq(collegeInfoTable.id, 1)).limit(1);
    const collegeInfo = collegeRows[0] || null;
    const currentAcademicYear = await getCollegeAcademicYear(collegeInfo);

    if (!user.hod_department_code) {
      return apiError('Unauthorized - Active HOD Assignment Required', 403);
    }

    // Verify the assignment belongs to a faculty in the HOD's department
    const assignmentCheck = await db.select({ id: facultySubjectAssignments.id })
      .from(facultySubjectAssignments)
      .innerJoin(staffAccounts, eq(facultySubjectAssignments.staff_account_id, staffAccounts.id))
      .innerJoin(staffAcademicAffiliations, eq(staffAcademicAffiliations.staff_account_id, staffAccounts.id))
      .innerJoin(academicDepartments, eq(staffAcademicAffiliations.department_id, academicDepartments.id))
      .where(and(
        eq(facultySubjectAssignments.id, id),
        eq(academicDepartments.department_code, user.hod_department_code)
      ))
      .limit(1);

    if (assignmentCheck.length === 0) {
        return apiError('Assignment not found or does not belong to your department.', 404);
    }

    await db.update(facultySubjectAssignments)
      .set({ is_active: false })
      .where(eq(facultySubjectAssignments.id, id));

    return apiResponse({ message: 'Assignment revoked' });
  }
});

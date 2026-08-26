import { db } from '@/db';
import { 
  facultySubjectAssignments, 
  staffAccounts,
  staffAccountRoles,
  staffRoles,
  facultyHodAssignments,
  collegeInfo as collegeInfoTable
} from '@/db/schema';
import { eq, and, asc, desc, sql } from 'drizzle-orm';
import { apiResponse, apiError, wrapHandler } from '@/lib/api-utils';
import { getCollegeAcademicYear } from '@/lib/academic-utils';

export const GET = wrapHandler({
  auth: 'hod',
  handler: async (_request, { user }) => {
    const collegeRows = await db.select().from(collegeInfoTable).where(eq(collegeInfoTable.id, 1)).limit(1);
    const collegeInfo = collegeRows[0] || null;
    const currentAcademicYear = await getCollegeAcademicYear(collegeInfo);

    // Verify HOD assignment
    const hodAssignment = await db.query.facultyHodAssignments.findFirst({
      where: and(
        eq(facultyHodAssignments.staff_account_id, user.id),
        eq(facultyHodAssignments.is_active, true),
        eq(facultyHodAssignments.academic_year, currentAcademicYear)
      )
    });

    if (!hodAssignment) {
      return apiError('Unauthorized - Active HOD Assignment Required', 403);
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
    .where(and(
      eq(staffAccounts.department_code, hodAssignment.department_code)
    ))
    .orderBy(desc(facultySubjectAssignments.is_active), desc(facultySubjectAssignments.course_semester), asc(facultySubjectAssignments.subject_name));

    return apiResponse({ data: assignments });
  }
});

export const POST = wrapHandler({
  auth: 'hod',
  handler: async (request, { user }) => {
    const { faculty_id, subject_code, subject_name, branch, semester, academic_year } = await request.json();

    if (!faculty_id || !subject_code || !semester || !branch) {
      return apiError('Missing required fields', 400);
    }
    
    if (academic_year && !academic_year.match(/^\d{4}-\d{2}$/)) {
      return apiError('Invalid academic_year format. Expected YYYY-YY', 400);
    }

    const collegeRows = await db.select().from(collegeInfoTable).where(eq(collegeInfoTable.id, 1)).limit(1);
    const collegeInfo = collegeRows[0] || null;
    const currentAcademicYear = await getCollegeAcademicYear(collegeInfo);

    const hodAssignment = await db.query.facultyHodAssignments.findFirst({
      where: and(
        eq(facultyHodAssignments.staff_account_id, user.id),
        eq(facultyHodAssignments.is_active, true),
        eq(facultyHodAssignments.academic_year, currentAcademicYear)
      )
    });

    if (!hodAssignment) {
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

    // Validate selected staff is valid, active Faculty, and belongs to HOD's department
    const staffCheck = await db.select({ id: staffAccounts.id })
      .from(staffAccounts)
      .innerJoin(staffAccountRoles, eq(staffAccountRoles.staff_account_id, staffAccounts.id))
      .innerJoin(staffRoles, eq(staffAccountRoles.role_id, staffRoles.id))
      .where(and(
        eq(staffAccounts.id, parseInt(faculty_id)),
        eq(staffAccounts.account_status, 'ACTIVE'),
        eq(staffRoles.role_code, 'FACULTY'),
        eq(staffAccounts.department_code, hodAssignment.department_code)
      ))
      .limit(1);

    if (staffCheck.length === 0) {
      return apiError('Selected staff is not a valid active Faculty member in your department.', 400);
    }

    await db.insert(facultySubjectAssignments).values({
      staff_account_id: parseInt(faculty_id),
      subject_code: subject_code,
      subject_name: subject_name,
      branch: branch,
      course_semester: parseInt(semester),
      academic_term: (parseInt(semester) % 2 === 0 ? 2 : 1),
      academic_year: academic_year || '2025-26',
      is_active: true
    })
    .onDuplicateKeyUpdate({
      set: {
        staff_account_id: sql`VALUES(staff_account_id)`,
        is_active: true
      }
    });

    return apiResponse({ message: 'Faculty assigned successfully' });
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

    const hodAssignment = await db.query.facultyHodAssignments.findFirst({
      where: and(
        eq(facultyHodAssignments.staff_account_id, user.id),
        eq(facultyHodAssignments.is_active, true),
        eq(facultyHodAssignments.academic_year, currentAcademicYear)
      )
    });

    if (!hodAssignment) {
      return apiError('Unauthorized - Active HOD Assignment Required', 403);
    }

    // Verify the assignment belongs to a faculty in the HOD's department
    const assignmentCheck = await db.select({ id: facultySubjectAssignments.id })
      .from(facultySubjectAssignments)
      .innerJoin(staffAccounts, eq(facultySubjectAssignments.staff_account_id, staffAccounts.id))
      .where(and(
        eq(facultySubjectAssignments.id, id),
        eq(staffAccounts.department_code, hodAssignment.department_code)
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

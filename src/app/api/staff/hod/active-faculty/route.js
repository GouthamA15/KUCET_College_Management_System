import { db } from '@/db';
import { 
  staffAccounts, 
  staffAccountRoles, 
  staffRoles,
  facultyHodAssignments,
  collegeInfo as collegeInfoTable
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';
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

    const activeFaculty = await db.select({
      id: staffAccounts.id,
      employee_id: staffAccounts.employee_id,
      name: staffAccounts.name,
      email: staffAccounts.email,
      designation: staffAccounts.designation,
      account_status: staffAccounts.account_status,
      department_code: staffAccounts.department_code
    })
    .from(staffAccounts)
    .innerJoin(staffAccountRoles, eq(staffAccountRoles.staff_account_id, staffAccounts.id))
    .innerJoin(staffRoles, eq(staffAccountRoles.role_id, staffRoles.id))
    .where(and(
      eq(staffRoles.role_code, 'FACULTY'),
      eq(staffAccounts.department_code, hodAssignment.department_code)
    ));

    return apiResponse({ data: activeFaculty });
  }
});

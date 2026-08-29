import { db } from '@/db';
import { 
  staffAccounts, 
  staffAccountRoles, 
  staffRoles,
  facultyHodAssignments,
  collegeInfo as collegeInfoTable,
  staffAcademicAffiliations,
  academicDepartments
} from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
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

    // 2. Fetch the faculty details without GROUP BY
    const activeFaculty = await db.select({
      id: staffAccounts.id,
      employee_id: staffAccounts.employee_id,
      name: staffAccounts.name,
      email: staffAccounts.email,
      designation: staffAccounts.designation,
      account_status: staffAccounts.account_status
    })
    .from(staffAccounts)
    .where(inArray(staffAccounts.id, eligibleStaffIds));

    // Append department code manually to maintain output contract
    const data = activeFaculty.map(f => ({
      ...f,
      department_code: user.hod_department_code
    }));

    return apiResponse({ data });
  }
});

import { db } from '@/db';
import { 
  staffAccounts, 
  staffAccountRoles, 
  staffRoles,
  staffAcademicAffiliations,
  academicDepartments
} from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { apiResponse, apiError, wrapHandler } from '@/lib/api-utils';
import { getAuthorizedAcademicBranches } from '@/lib/academic-authorization';

export const GET = wrapHandler({
  auth: ['hod', 'first_year_coordinator', 'faculty', 'admin'],
  handler: async (request, { user }) => {
    const isHod = !!user.is_hod;
    const isCoord = !!user.is_first_year_coordinator;
    const isAdmin = user.role === 'admin' || !!user.is_principal;

    if (!isHod && !isCoord && !isAdmin) {
      return apiError('Unauthorized - HOD or First Year Coordinator role required', 403);
    }

    const url = new URL(request.url);
    const requestedDept = url.searchParams.get('branch') || url.searchParams.get('department') || request.nextUrl?.searchParams?.get('branch') || request.nextUrl?.searchParams?.get('department');
    const targetDept = requestedDept || user.hod_department_code || user.branch;

    if (!targetDept) {
      return apiError('Department or branch parameter required', 400);
    }

    const authorizedBranches = getAuthorizedAcademicBranches(user);
    if (authorizedBranches !== null && !authorizedBranches.includes(targetDept.toUpperCase())) {
      return apiError(`Forbidden - Not authorized for ${targetDept} department`, 403);
    }

    // 1. Fetch eligible Faculty Staff IDs in the target department
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
      eq(academicDepartments.department_code, targetDept)
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
      department_code: targetDept
    }));

    return apiResponse({ data });
  }
});

import logger from '@/lib/logger';
import { db } from '@/db';
import { staffAccounts, staffRoles, staffAccountRoles, staffAcademicAffiliations, academicDepartments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function GET() {
  const user = await getAuthUser('admin');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const data = await db.select({
      id: staffAccounts.id,
      name: staffAccounts.name,
      email: staffAccounts.email,
      employee_id: staffAccounts.employee_id,
      role: staffRoles.role_code,
      is_hod: staffAcademicAffiliations.is_hod,
      branch: academicDepartments.department_code,
      is_active: staffAccounts.account_status,
      created_at: staffAccounts.created_at,
      updated_at: staffAccounts.updated_at
    })
    .from(staffAccounts)
    .leftJoin(staffAccountRoles, eq(staffAccounts.id, staffAccountRoles.staff_account_id))
    .leftJoin(staffRoles, eq(staffAccountRoles.role_id, staffRoles.id))
    .leftJoin(staffAcademicAffiliations, eq(staffAccounts.id, staffAcademicAffiliations.staff_account_id))
    .leftJoin(academicDepartments, eq(staffAcademicAffiliations.department_id, academicDepartments.id));

    const formattedData = data.map(staff => {
      let mappedRole = 'faculty';
      if (staff.role === 'ADMISSION_CLERK') mappedRole = 'admission';
      else if (staff.role === 'SCHOLARSHIP_CLERK') mappedRole = 'scholarship';

      return {
        ...staff,
        role: mappedRole,
        is_active: staff.is_active === 'ACTIVE',
        is_hod: staff.is_hod ? true : false,
        branch: staff.branch || null
      };
    });

    return apiResponse({ data: formattedData });
  } catch (error) {
    logger.error('Error fetching clerks:', error);
    return apiError('Internal Server Error', 500);
  }
}

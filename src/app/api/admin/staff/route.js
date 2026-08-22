import logger from '@/lib/logger';
import { db } from '@/db';
import { staffAccounts, staffRoles, staffAccountRoles, staffAcademicAffiliations, academicDepartments, academicPrograms, facultyHodAssignments } from '@/db/schema';
import { eq, sql, and } from 'drizzle-orm';
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
      branch: sql`COALESCE(${academicPrograms.program_code}, ${academicDepartments.department_code})`.as('branch'),
      is_active: staffAccounts.account_status,
      is_hod: sql`CASE WHEN ${facultyHodAssignments.id} IS NOT NULL AND ${facultyHodAssignments.is_active} = 1 THEN 1 ELSE 0 END`.as('is_hod'),
      created_at: staffAccounts.created_at,
      updated_at: staffAccounts.updated_at
    })
    .from(staffAccounts)
    .leftJoin(staffAccountRoles, eq(staffAccounts.id, staffAccountRoles.staff_account_id))
    .leftJoin(staffRoles, eq(staffAccountRoles.role_id, staffRoles.id))
    .leftJoin(staffAcademicAffiliations, eq(staffAccounts.id, staffAcademicAffiliations.staff_account_id))
    .leftJoin(academicDepartments, eq(staffAcademicAffiliations.department_id, academicDepartments.id))
    .leftJoin(academicPrograms, eq(staffAcademicAffiliations.program_id, academicPrograms.id))
    .leftJoin(facultyHodAssignments, and(
      eq(staffAccounts.id, facultyHodAssignments.staff_account_id),
      eq(facultyHodAssignments.is_active, true)
    ));

    const staffMap = new Map();

    data.forEach(row => {
      if (!staffMap.has(row.id)) {
        staffMap.set(row.id, {
          id: row.id,
          name: row.name,
          email: row.email,
          employee_id: row.employee_id,
          is_active: row.is_active === 'ACTIVE',
          created_at: row.created_at,
          updated_at: row.updated_at,
          roles: new Set(),
          branches: new Set(),
          is_hod: false
        });
      }
      
      const staff = staffMap.get(row.id);
      
      if (row.role) {
        let mappedRole = 'faculty';
        if (row.role?.includes('ADMISSION')) mappedRole = 'admission';
        else if (row.role?.includes('SCHOLARSHIP')) mappedRole = 'scholarship';
        staff.roles.add(mappedRole);
      }
      
      if (row.branch) {
        staff.branches.add(row.branch);
      }
      
      if (row.is_hod) {
        staff.is_hod = true;
      }
    });

    const formattedData = Array.from(staffMap.values()).map(staff => ({
      ...staff,
      roles: Array.from(staff.roles),
      branches: Array.from(staff.branches),
    }));

    return apiResponse({ data: formattedData });
  } catch (error) {
    logger.error('Error fetching staff:', error);
    return apiError('Internal Server Error', 500);
  }
}

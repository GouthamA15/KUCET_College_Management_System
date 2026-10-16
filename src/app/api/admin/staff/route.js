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
      hod_dept: facultyHodAssignments.department_code,
      hod_is_active: facultyHodAssignments.is_active,
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
          hod_branches: new Set(),
          is_hod: false,
          is_principal: false
        });
      }
      
      const staff = staffMap.get(row.id);
      
      if (row.role) {
        let mappedRole = 'faculty';
        if (row.role === 'ADMISSION_STAFF') mappedRole = 'admission';
        else if (row.role === 'SCHOLARSHIP_STAFF') mappedRole = 'scholarship';
        else if (row.role === 'PRINCIPAL') {
          staff.is_principal = true;
        }
        staff.roles.add(mappedRole);
      }
      
      if (row.branch) {
        staff.branches.add(row.branch);
      }
      
      if (row.hod_is_active && row.hod_dept) {
        staff.hod_branches.add(row.hod_dept);
        staff.is_hod = true;
      }
    });

    // Query active HODs per department directory
    const activeHodRows = await db.select({
      dept: facultyHodAssignments.department_code,
      academic_year: facultyHodAssignments.academic_year,
      staff_id: staffAccounts.id,
      name: staffAccounts.name
    })
    .from(facultyHodAssignments)
    .innerJoin(staffAccounts, eq(facultyHodAssignments.staff_account_id, staffAccounts.id))
    .where(eq(facultyHodAssignments.is_active, true));

    const activeHodDirectory = {};
    activeHodRows.forEach(h => {
      activeHodDirectory[h.dept] = {
        staff_id: h.staff_id,
        name: h.name,
        academic_year: h.academic_year
      };
    });

    const formattedData = Array.from(staffMap.values()).map(staff => ({
      ...staff,
      roles: Array.from(staff.roles),
      branches: Array.from(staff.branches),
      hod_branches: Array.from(staff.hod_branches),
      is_hod: staff.hod_branches.size > 0,
      is_principal: !!staff.is_principal
    }));

    return apiResponse({ data: formattedData, active_hod_directory: activeHodDirectory });
  } catch (error) {
    logger.error('Error fetching staff:', error);
    return apiError('Internal Server Error', 500);
  }
}

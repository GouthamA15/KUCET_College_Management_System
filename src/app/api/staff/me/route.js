import logger from '@/lib/logger';
import { db } from '@/db';
import { staffAccounts, staffAccountRoles, staffRoles, staffAcademicAffiliations, academicDepartments, academicPrograms } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiError, wrapHandler } from '@/lib/api-utils';
import { getCollegeAcademicYear } from '@/lib/academic-utils';

export const GET = wrapHandler({
  auth: 'staff',
  handler: async (req, { user }) => {
    const staffId = user.id;
    if (!staffId) {
      logger.error({ user }, '[STAFF_ME_ERROR] No staffId found in token');
      return apiError('Invalid session', 401);
    }

    const rows = await db.select({
      id: staffAccounts.id,
      name: staffAccounts.name,
      email: staffAccounts.email,
      mobile_hash: staffAccounts.mobile_hash,
      employee_id: staffAccounts.employee_id,
      pfp: staffAccounts.pfp,
      signature: staffAccounts.signature,
      address: staffAccounts.address,
      designation: staffAccounts.designation,
      account_status: staffAccounts.account_status,
      last_login_at: staffAccounts.last_login_at,
      last_login_ip: staffAccounts.last_login_ip,
      created_at: staffAccounts.created_at,
      updated_at: staffAccounts.updated_at
    })
    .from(staffAccounts)
    .where(eq(staffAccounts.id, staffId))
    .limit(1);

    if (rows.length === 0) return apiError('Staff not found', 404);
    const staff = rows[0];

    // Fetch Role
    const roleRecords = await db.select({ role_code: staffRoles.role_code })
      .from(staffAccountRoles)
      .innerJoin(staffRoles, eq(staffAccountRoles.role_id, staffRoles.id))
      .where(eq(staffAccountRoles.staff_account_id, staff.id));
      
    const roleCodes = roleRecords.map(r => r.role_code);
    let resolvedRole = 'faculty';
    if (roleCodes.includes('ADMISSION_STAFF')) resolvedRole = 'admission';
    else if (roleCodes.includes('SCHOLARSHIP_STAFF')) resolvedRole = 'scholarship';
    else resolvedRole = 'faculty';

    // Fetch HOD & Branch
    let isHod = false;
    let isPrincipal = false;
    let hodBranches = [];
    let authorizedBranches = [];
    let branch = null;
    let branches = [];
    let departments = [];
    let department_names = [];
    if (resolvedRole === 'faculty') {
        const affil = await db.select({ 
              dept_id: academicDepartments.id,
              dept_code: academicDepartments.department_code, 
              dept_name: academicDepartments.department_name,
              prog_code: academicPrograms.program_code 
            })
            .from(staffAcademicAffiliations)
            .innerJoin(academicDepartments, eq(staffAcademicAffiliations.department_id, academicDepartments.id))
            .leftJoin(academicPrograms, eq(staffAcademicAffiliations.program_id, academicPrograms.id))
            .where(eq(staffAcademicAffiliations.staff_account_id, staff.id));
            
        if (affil.length > 0) {
          const allocatedProgramCodes = affil.map(a => a.prog_code).filter(Boolean);
          
          const rawDepts = affil.map(a => a.dept_code);
          const rawDeptNames = affil.map(a => a.dept_name);

          branches = Array.from(new Set(allocatedProgramCodes));
          departments = Array.from(new Set(rawDepts.filter(Boolean)));
          department_names = Array.from(new Set(rawDeptNames.filter(Boolean)));
          branch = branches.length > 0 ? branches[0] : null;
        }

        const { facultyHodAssignments, staffAccountRoles, staffRoles } = await import('@/db/schema');
        const { and, lte, gte, isNull, or } = await import('drizzle-orm');
        const now = new Date();
        const nowStr = now.toISOString().split('T')[0];

        // 1. Check if they have the PRINCIPAL role
        const principalCheck = await db.select({ role_code: staffRoles.role_code })
            .from(staffAccountRoles)
            .innerJoin(staffRoles, eq(staffAccountRoles.role_id, staffRoles.id))
            .where(
                and(
                    eq(staffAccountRoles.staff_account_id, staff.id),
                    eq(staffRoles.role_code, 'PRINCIPAL')
                )
            ).limit(1);
        isPrincipal = principalCheck.length > 0;

        // 2. Fetch active HOD assignments
        const activeHodRows = await db.select({ dept: facultyHodAssignments.department_code })
            .from(facultyHodAssignments)
            .where(and(
              eq(facultyHodAssignments.staff_account_id, staff.id),
              eq(facultyHodAssignments.is_active, true),
              lte(facultyHodAssignments.start_date, nowStr),
              or(
                isNull(facultyHodAssignments.end_date),
                gte(facultyHodAssignments.end_date, nowStr)
              )
            ));

        hodBranches = activeHodRows.map(r => r.dept);
        isHod = isPrincipal || hodBranches.length > 0;
        authorizedBranches = isPrincipal
          ? Array.from(new Set([...hodBranches, 'CSE', 'IT', 'CSD', 'ECE', 'CIVIL', 'MECH', 'EEE']))
          : hodBranches;
    }

    let isFirstYearCoordinator = false;
    let coordinatorAssignment = null;
    if (resolvedRole === 'faculty') {
      try {
        const { CoordinatorAssignmentService } = await import('@/services/identity/CoordinatorAssignmentService');
        const activeCoord = await CoordinatorAssignmentService.getActiveCoordinatorForStaff(staff.id);
        if (activeCoord) {
          isFirstYearCoordinator = true;
          coordinatorAssignment = activeCoord;
        }
      } catch (_e) {
        // Non-fatal
      }
    }

    let decryptedMobile = '';
    if (staff.mobile_hash) {
      try {
        const { decrypt } = require('@/lib/encryption');
        decryptedMobile = decrypt(staff.mobile_hash);
      } catch (e) {
        logger.error({ err: e.message }, '[DECRYPT_MOBILE_ERROR]');
      }
    }

    // Construct staff object properties
    const staffData = {
      ...staff,
      mobile: decryptedMobile,
      role: resolvedRole,
      is_hod: isHod,
      is_principal: Boolean(isPrincipal),
      is_first_year_coordinator: isFirstYearCoordinator,
      coordinator_assignment: coordinatorAssignment,
      hod_branches: hodBranches,
      authorized_branches: authorizedBranches,
      hod_department_code: hodBranches[0] || (isPrincipal ? 'CSE' : branch),
      branch: branch || hodBranches[0] || (isPrincipal ? 'CSE' : null),
      branches: branches,
      department: departments.length > 0 ? departments[0] : null,
      departments: departments,
      department_name: department_names.length > 0 ? department_names[0] : null,
      department_names: department_names,
      designation: staff.designation,
      is_active: staff.account_status === 'ACTIVE',
    };

    // Helper to handle both URLs and Buffer data
    const imageHelper = (val) => {
      if (!val) return null;
      if (typeof val === 'string' && (val.startsWith('http') || val.startsWith('data:') || val.startsWith('/api/'))) return val;
      if (Buffer.isBuffer(val)) return `data:image/png;base64,${val.toString('base64')}`;
      if (typeof val === 'string') {
        const { getStorageProvider } = require('@/lib/providers/storage/factory');
        return getStorageProvider().getUrl(val);
      }
      return null;
    };

    staffData.pfp = imageHelper(staffData.pfp);
    staffData.signature = imageHelper(staffData.signature);

    try {
      staffData.academic_year = await getCollegeAcademicYear();
    } catch (semErr) {
      logger.error({ err: semErr.message }, '[STAFF_ME_SEMESTER_FAILED]');
    }

    return { data: staffData };
  }
});

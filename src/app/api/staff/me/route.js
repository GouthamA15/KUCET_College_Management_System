import logger from '@/lib/logger';
import { db } from '@/db';
import { staffAccounts, staffAccountRoles, staffRoles, staffAcademicAffiliations, academicDepartments, semesters } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { apiError, wrapHandler } from '@/lib/api-utils';

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
      .where(eq(staffAccountRoles.staff_account_id, staff.id))
      .limit(1);
      
    let resolvedRole = 'faculty';
    if (roleRecords.length > 0) {
        const rCode = roleRecords[0].role_code;
        if (rCode?.includes('ADMISSION')) resolvedRole = 'admission';
        else if (rCode?.includes('SCHOLARSHIP')) resolvedRole = 'scholarship';
        else resolvedRole = 'faculty';
    }

    // Fetch HOD & Branch
    let isHod = false;
    let branch = null;
    if (resolvedRole === 'faculty') {
        const affil = await db.select({ branch_code: academicDepartments.department_code })
            .from(staffAcademicAffiliations)
            .innerJoin(academicDepartments, eq(staffAcademicAffiliations.department_id, academicDepartments.id))
            .where(eq(staffAcademicAffiliations.staff_account_id, staff.id))
            .limit(1);
        if (affil.length > 0) {
          branch = affil[0].branch_code;
        }

        const { facultyHodAssignments } = await import('@/db/schema');
        const { and } = await import('drizzle-orm');
        const hodRow = await db.select({ id: facultyHodAssignments.id })
            .from(facultyHodAssignments)
            .where(and(
              eq(facultyHodAssignments.staff_account_id, staff.id),
              eq(facultyHodAssignments.is_active, true)
            ))
            .limit(1);
        if (hodRow.length > 0) {
          isHod = true;
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
      branch: branch,
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
      const semRows = await db.select({ academic_year: semesters.academic_year })
        .from(semesters)
        .orderBy(desc(semesters.id))
        .limit(1);
      
      staffData.academic_year = semRows[0]?.academic_year || '2025-26';
    } catch (semErr) {
      logger.error({ err: semErr.message }, '[STAFF_ME_SEMESTER_FAILED]');
      staffData.academic_year = '2025-26';
    }

    return { data: staffData };
  }
});

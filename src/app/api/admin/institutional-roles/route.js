import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  staffAccounts, 
  staffRoles, 
  staffAccountRoles, 
  staffAcademicAffiliations, 
  academicDepartments, 
  academicPrograms, 
  systemConfigs, 
  auditLogs 
} from '@/db/schema';
import { eq, or, desc, inArray, sql } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function GET() {
  const user = await getAuthUser('admin');
  if (!user) return apiError('Unauthorized', 401);

  try {
    // 1. Fetch systemConfigs for Designated Academic Supervisor
    const configRows = await db.select()
      .from(systemConfigs)
      .where(or(
        eq(systemConfigs.config_key, 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID'),
        eq(systemConfigs.config_key, 'DESIGNATED_ACADEMIC_SUPERVISOR_EMAIL')
      ));

    const staffIdCfg = configRows.find(c => c.config_key === 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID');
    const emailCfg = configRows.find(c => c.config_key === 'DESIGNATED_ACADEMIC_SUPERVISOR_EMAIL');

    const rawConfigStaffId = (staffIdCfg?.config_value ?? '').trim();
    const rawConfigEmail = (emailCfg?.config_value ?? '').trim().toLowerCase();

    // 2. Query all staff accounts with their roles and affiliations
    const rawStaffData = await db.select({
      id: staffAccounts.id,
      name: staffAccounts.name,
      email: staffAccounts.email,
      employee_id: staffAccounts.employee_id,
      designation: staffAccounts.designation,
      staff_category: staffAccounts.staff_category,
      account_status: staffAccounts.account_status,
      role_code: staffRoles.role_code,
      role_name: staffRoles.role_name,
      branch: sql`COALESCE(${academicPrograms.program_code}, ${academicDepartments.department_code})`.as('branch'),
      created_at: staffAccounts.created_at,
      updated_at: staffAccounts.updated_at
    })
    .from(staffAccounts)
    .leftJoin(staffAccountRoles, eq(staffAccounts.id, staffAccountRoles.staff_account_id))
    .leftJoin(staffRoles, eq(staffAccountRoles.role_id, staffRoles.id))
    .leftJoin(staffAcademicAffiliations, eq(staffAccounts.id, staffAcademicAffiliations.staff_account_id))
    .leftJoin(academicDepartments, eq(staffAcademicAffiliations.department_id, academicDepartments.id))
    .leftJoin(academicPrograms, eq(staffAcademicAffiliations.program_id, academicPrograms.id));

    const staffMap = new Map();
    rawStaffData.forEach(row => {
      if (!staffMap.has(row.id)) {
        staffMap.set(row.id, {
          id: row.id,
          name: row.name,
          email: row.email,
          employee_id: row.employee_id,
          designation: row.designation,
          staff_category: row.staff_category,
          account_status: row.account_status,
          is_active: row.account_status === 'ACTIVE',
          roles: new Set(),
          branches: new Set(),
          has_principal_role: false,
          created_at: row.created_at,
          updated_at: row.updated_at
        });
      }

      const item = staffMap.get(row.id);
      if (row.role_code) {
        item.roles.add(row.role_code);
        if (row.role_code === 'PRINCIPAL') {
          item.has_principal_role = true;
        }
      }
      if (row.branch) {
        item.branches.add(row.branch);
      }
    });

    const allStaff = Array.from(staffMap.values()).map(s => ({
      ...s,
      roles: Array.from(s.roles),
      branches: Array.from(s.branches),
    }));

    // 3. Determine Supervisor Status
    let designatedSupervisor = null;
    let authorizationStatus = 'UNCONFIGURED';
    let statusDescription = 'No Academic Supervisor currently designated. Global supervisory access fails closed.';

    if (!rawConfigStaffId || rawConfigStaffId === '' || ['null', 'undefined', 'nan', '0', '-1'].includes(rawConfigStaffId.toLowerCase())) {
      authorizationStatus = 'UNCONFIGURED';
      statusDescription = 'Designated Academic Supervisor is unconfigured. Global supervisor access is disabled (fail-closed).';
    } else if (['revoked', 'none'].includes(rawConfigStaffId.toLowerCase())) {
      authorizationStatus = 'REVOKED';
      statusDescription = 'Academic Supervisor designation has been explicitly revoked by administration. Global supervisor access is disabled.';
    } else {
      const parsedId = Number(rawConfigStaffId);
      if (isNaN(parsedId) || parsedId <= 0) {
        authorizationStatus = 'MALFORMED_CONFIG';
        statusDescription = `Configuration contains invalid non-numeric ID "${rawConfigStaffId}". Global supervisor access fails closed.`;
      } else {
        const matchedStaff = staffMap.get(parsedId);
        if (!matchedStaff) {
          authorizationStatus = 'ACCOUNT_NOT_FOUND';
          statusDescription = `Configured staff ID ${parsedId} does not exist in staff accounts. Global supervisor access fails closed.`;
        } else if (matchedStaff.account_status !== 'ACTIVE') {
          authorizationStatus = 'INACTIVE_ACCOUNT';
          statusDescription = `Designated staff account (${matchedStaff.name}) has status "${matchedStaff.account_status}". Global supervisor access is blocked until account is active.`;
          designatedSupervisor = {
            ...matchedStaff,
            is_designated_supervisor: true,
          };
        } else if (!matchedStaff.has_principal_role) {
          authorizationStatus = 'PRINCIPAL_ROLE_MISSING';
          statusDescription = `Designated staff member (${matchedStaff.name}) lacks the required institutional PRINCIPAL role. Global supervisor access is blocked until the Principal role is assigned.`;
          designatedSupervisor = {
            ...matchedStaff,
            is_designated_supervisor: true,
          };
        } else {
          authorizationStatus = 'ACTIVE_AUTHORIZED';
          statusDescription = `Authoritative global Academic Supervisor active. Professor ${matchedStaff.name} holds global monitoring authority across all academic branches.`;
          designatedSupervisor = {
            ...matchedStaff,
            is_designated_supervisor: true,
          };
        }
      }
    }

    // Mark is_designated_supervisor on roster
    const parsedDesignatedId = (rawConfigStaffId && !['revoked', 'none', 'null', 'undefined'].includes(rawConfigStaffId.toLowerCase()))
      ? Number(rawConfigStaffId)
      : null;

    const formattedRoster = allStaff.map(s => ({
      ...s,
      is_designated_supervisor: parsedDesignatedId !== null && s.id === parsedDesignatedId,
    }));

    const principalAccounts = formattedRoster.filter(s => s.has_principal_role);

    // 4. Fetch recent relevant audit logs
    const auditRows = await db.select({
      id: auditLogs.id,
      user_id: auditLogs.user_id,
      user_type: auditLogs.user_type,
      action: auditLogs.action,
      target_id: auditLogs.target_id,
      target_type: auditLogs.target_type,
      payload_before: auditLogs.payload_before,
      payload_after: auditLogs.payload_after,
      ip_address: auditLogs.ip_address,
      user_agent: auditLogs.user_agent,
      created_at: auditLogs.created_at,
    })
    .from(auditLogs)
    .where(inArray(auditLogs.action, [
      'PRINCIPAL_ROLE_ASSIGNED',
      'PRINCIPAL_ROLE_REVOKED',
      'ACADEMIC_SUPERVISOR_DESIGNATED',
      'ACADEMIC_SUPERVISOR_REPLACED',
      'ACADEMIC_SUPERVISOR_REVOKED'
    ]))
    .orderBy(desc(auditLogs.id))
    .limit(30);

    const formattedAudit = auditRows.map(row => {
      const targetIdNum = Number(row.target_id);
      const targetStaff = !isNaN(targetIdNum) ? staffMap.get(targetIdNum) : null;
      return {
        ...row,
        target_name: targetStaff ? targetStaff.name : (row.target_id || 'System Config'),
        target_email: targetStaff ? targetStaff.email : null,
      };
    });

    return apiResponse({
      data: {
        designated_supervisor: designatedSupervisor ? {
          ...designatedSupervisor,
          config_staff_id: rawConfigStaffId,
          config_email: rawConfigEmail,
          authorization_status: authorizationStatus,
          status_description: statusDescription,
        } : {
          config_staff_id: rawConfigStaffId || null,
          config_email: rawConfigEmail || null,
          authorization_status: authorizationStatus,
          status_description: statusDescription,
          staff: null
        },
        principal_accounts: principalAccounts,
        eligible_staff: formattedRoster.filter(s => s.is_active),
        all_staff: formattedRoster,
        audit_history: formattedAudit
      }
    });
  } catch (error) {
    logger.error('Error fetching institutional roles data:', error);
    return apiError('Internal Server Error', 500);
  }
}

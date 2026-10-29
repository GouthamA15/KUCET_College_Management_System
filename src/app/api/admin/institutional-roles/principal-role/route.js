import logger from '@/lib/logger';
import { db } from '@/db';
import { staffAccounts, staffRoles, staffAccountRoles, systemConfigs } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser, logAudit } from '@/lib/api-utils';
import { z } from 'zod';

const PrincipalRoleMutationSchema = z.object({
  staff_id: z.coerce.number().int().positive({ message: 'Valid positive staff ID is required' }),
  action: z.enum(['ASSIGN', 'REVOKE'], { message: 'Action must be ASSIGN or REVOKE' }),
});

export async function POST(req) {
  const user = await getAuthUser('admin');
  if (!user) return apiError('Unauthorized', 401);

  let body;
  try {
    body = await req.json();
  } catch (_e) {
    return apiError('Invalid JSON payload', 400);
  }

  const parsed = PrincipalRoleMutationSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Validation Error', 400, parsed.error.format());
  }

  const { staff_id: staffId, action } = parsed.data;

  try {
    // 1. Verify target staff account exists
    const [targetAccount] = await db.select({
      id: staffAccounts.id,
      name: staffAccounts.name,
      email: staffAccounts.email,
      employee_id: staffAccounts.employee_id,
      account_status: staffAccounts.account_status,
      designation: staffAccounts.designation,
    })
    .from(staffAccounts)
    .where(eq(staffAccounts.id, staffId))
    .limit(1);

    if (!targetAccount) {
      return apiError(`Staff account with ID ${staffId} not found`, 404);
    }

    // 2. Resolve PRINCIPAL role definition dynamically
    let [principalRoleDef] = await db.select()
      .from(staffRoles)
      .where(eq(staffRoles.role_code, 'PRINCIPAL'))
      .limit(1);

    if (!principalRoleDef && action === 'ASSIGN') {
      const [ins] = await db.insert(staffRoles).values({
        role_code: 'PRINCIPAL',
        role_name: 'Principal / Academic Supervisor',
        description: 'Principal-level institutional supervisor with oversight across CSE, IT, and CSD'
      });
      principalRoleDef = { id: ins.insertId, role_code: 'PRINCIPAL' };
    }

    if (action === 'ASSIGN') {
      if (['SUSPENDED', 'DISABLED'].includes(targetAccount.account_status)) {
        return apiError(`Cannot assign Principal role to an inactive staff account (status: ${targetAccount.account_status})`, 400);
      }

      // Check if already assigned
      const existingMapping = await db.select()
        .from(staffAccountRoles)
        .where(and(
          eq(staffAccountRoles.staff_account_id, staffId),
          eq(staffAccountRoles.role_id, principalRoleDef.id)
        ))
        .limit(1);

      if (existingMapping.length > 0) {
        return apiResponse({
          status: 'success',
          message: `Staff member ${targetAccount.name} already holds the Principal role.`,
          staff_id: staffId,
          already_assigned: true
        });
      }

      await db.insert(staffAccountRoles).values({
        staff_account_id: staffId,
        role_id: principalRoleDef.id,
        assigned_by: user.id
      });

      await logAudit(req, {
        userId: user.id,
        userType: 'admin',
        action: 'PRINCIPAL_ROLE_ASSIGNED',
        targetId: String(staffId),
        targetType: 'staff_accounts',
        after: {
          staff_id: staffId,
          name: targetAccount.name,
          email: targetAccount.email,
          role: 'PRINCIPAL',
          assigned_by: user.id
        }
      });

      return apiResponse({
        status: 'success',
        message: `Institutional Principal role successfully assigned to ${targetAccount.name}.`,
        staff_id: staffId
      });

    } else if (action === 'REVOKE') {
      // Guard: Cannot revoke Principal role if currently the active designated supervisor
      const [currentSupervisorCfg] = await db.select()
        .from(systemConfigs)
        .where(eq(systemConfigs.config_key, 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID'))
        .limit(1);

      const activeSupervisorId = currentSupervisorCfg?.config_value?.trim();
      if (activeSupervisorId && activeSupervisorId === String(staffId)) {
        return apiError(
          `Cannot revoke the Principal role from ${targetAccount.name} while this account is the active Designated Academic Supervisor. Please revoke or reassign the Academic Supervisor designation first.`,
          409
        );
      }

      if (principalRoleDef) {
        await db.delete(staffAccountRoles).where(and(
          eq(staffAccountRoles.staff_account_id, staffId),
          eq(staffAccountRoles.role_id, principalRoleDef.id)
        ));
      }

      await logAudit(req, {
        userId: user.id,
        userType: 'admin',
        action: 'PRINCIPAL_ROLE_REVOKED',
        targetId: String(staffId),
        targetType: 'staff_accounts',
        before: {
          staff_id: staffId,
          name: targetAccount.name,
          email: targetAccount.email,
          role: 'PRINCIPAL'
        },
        after: {
          role_revoked: true,
          revoked_by: user.id
        }
      });

      return apiResponse({
        status: 'success',
        message: `Institutional Principal role successfully revoked from ${targetAccount.name}.`,
        staff_id: staffId
      });
    }

    return apiError('Unsupported action', 400);
  } catch (error) {
    logger.error('Error in principal role mutation:', error);
    return apiError('Internal Server Error', 500);
  }
}

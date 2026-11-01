import logger from '@/lib/logger';
import { db } from '@/db';
import { staffAccounts, staffRoles, staffAccountRoles, systemConfigs } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { z } from 'zod';

const AcademicSupervisorMutationSchema = z.object({
  action: z.enum(['DESIGNATE', 'REVOKE'], { message: 'Action must be DESIGNATE or REVOKE' }),
  staff_id: z.coerce.number().int().positive().optional(),
}).refine(data => {
  if (data.action === 'DESIGNATE' && !data.staff_id) {
    return false;
  }
  return true;
}, {
  message: 'Staff ID is required when action is DESIGNATE',
  path: ['staff_id']
});

async function upsertSystemConfig(tx, key, value, description, updatedBy) {
  const [existing] = await tx.select().from(systemConfigs).where(eq(systemConfigs.config_key, key)).limit(1);
  if (existing) {
    await tx.update(systemConfigs).set({
      config_value: value,
      data_type: 'STRING',
      updated_at: new Date(),
      updated_by: String(updatedBy)
    }).where(eq(systemConfigs.config_key, key));
  } else {
    await tx.insert(systemConfigs).values({
      config_key: key,
      config_value: value,
      data_type: 'STRING',
      description,
      updated_by: String(updatedBy)
    });
  }
}

export async function POST(req) {
  const user = await getAuthUser('admin');
  if (!user) return apiError('Unauthorized', 401);

  let body;
  try {
    body = await req.json();
  } catch (_e) {
    return apiError('Invalid JSON payload', 400);
  }

  const parsed = AcademicSupervisorMutationSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Validation Error', 400, parsed.error.format());
  }

  const { action, staff_id: staffId } = parsed.data;

  try {
    if (action === 'DESIGNATE') {
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

      // 2. Status verification
      if (targetAccount.account_status !== 'ACTIVE') {
        return apiError(
          `Cannot designate an inactive staff account as Academic Supervisor (account status is ${targetAccount.account_status}). Account must be ACTIVE.`,
          400
        );
      }

      // 3. Enforce Institutional Policy: Must hold PRINCIPAL role
      const principalRoles = await db.select({ role_code: staffRoles.role_code })
        .from(staffAccountRoles)
        .innerJoin(staffRoles, eq(staffAccountRoles.role_id, staffRoles.id))
        .where(and(
          eq(staffAccountRoles.staff_account_id, staffId),
          eq(staffRoles.role_code, 'PRINCIPAL')
        ));

      if (!principalRoles || principalRoles.length === 0) {
        return apiError(
          `Staff member ${targetAccount.name} does not hold the institutional Principal role. The designated Academic Supervisor must hold the Principal role. Please assign the Principal role first.`,
          400
        );
      }

      // 4. Check current designation state
      const [currentStaffIdCfg] = await db.select()
        .from(systemConfigs)
        .where(eq(systemConfigs.config_key, 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID'))
        .limit(1);

      const previousStaffId = currentStaffIdCfg?.config_value?.trim();

      if (previousStaffId === String(staffId)) {
        return apiResponse({
          status: 'success',
          message: `${targetAccount.name} is already the active designated Academic Supervisor.`,
          staff_id: staffId,
          already_designated: true
        });
      }

      // 5. Execute atomic transaction
      await db.transaction(async (tx) => {
        await upsertSystemConfig(
          tx,
          'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID',
          String(staffId),
          'Canonical staff account ID for global Academic Supervisor monitoring privileges',
          user.id
        );

        await upsertSystemConfig(
          tx,
          'DESIGNATED_ACADEMIC_SUPERVISOR_EMAIL',
          targetAccount.email.trim().toLowerCase(),
          'Canonical staff email for global Academic Supervisor monitoring privileges',
          user.id
        );

        const auditAction = (previousStaffId && !['revoked', 'none', 'null', 'undefined', ''].includes(previousStaffId.toLowerCase()))
          ? 'ACADEMIC_SUPERVISOR_REPLACED'
          : 'ACADEMIC_SUPERVISOR_DESIGNATED';

        await tx.insert(db.schema?.auditLogs || (await import('@/db/schema')).auditLogs).values({
          user_id: user.id,
          user_type: 'admin',
          action: auditAction,
          target_id: String(staffId),
          target_type: 'system_configs',
          payload_before: previousStaffId ? { staff_id: previousStaffId } : null,
          payload_after: {
            staff_id: staffId,
            name: targetAccount.name,
            email: targetAccount.email,
            designated_by: user.id
          },
          ip_address: (req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || '127.0.0.1').trim().slice(0, 45),
          user_agent: (req.headers.get('user-agent') || 'system').slice(0, 500)
        });
      });

      return apiResponse({
        status: 'success',
        message: `Academic Supervisor designation successfully granted to ${targetAccount.name} (Staff ID: ${staffId}). Global monitoring authority activated.`,
        staff_id: staffId
      });

    } else if (action === 'REVOKE') {
      const [currentStaffIdCfg] = await db.select()
        .from(systemConfigs)
        .where(eq(systemConfigs.config_key, 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID'))
        .limit(1);

      const previousStaffId = currentStaffIdCfg?.config_value?.trim();

      if (!previousStaffId || ['revoked', 'none', ''].includes(previousStaffId.toLowerCase())) {
        return apiResponse({
          status: 'success',
          message: 'Academic Supervisor designation is already unconfigured or revoked.',
          already_revoked: true
        });
      }

      await db.transaction(async (tx) => {
        await upsertSystemConfig(
          tx,
          'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID',
          'REVOKED',
          'Canonical staff account ID for global Academic Supervisor monitoring privileges',
          user.id
        );

        await upsertSystemConfig(
          tx,
          'DESIGNATED_ACADEMIC_SUPERVISOR_EMAIL',
          '',
          'Canonical staff email for global Academic Supervisor monitoring privileges',
          user.id
        );

        await tx.insert(db.schema?.auditLogs || (await import('@/db/schema')).auditLogs).values({
          user_id: user.id,
          user_type: 'admin',
          action: 'ACADEMIC_SUPERVISOR_REVOKED',
          target_id: 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID',
          target_type: 'system_configs',
          payload_before: { staff_id: previousStaffId },
          payload_after: { status: 'REVOKED', revoked_by: user.id },
          ip_address: (req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || '127.0.0.1').trim().slice(0, 45),
          user_agent: (req.headers.get('user-agent') || 'system').slice(0, 500)
        });
      });

      return apiResponse({
        status: 'success',
        message: 'Academic Supervisor designation has been explicitly revoked. Global supervisory monitoring access is now disabled (fail-closed).'
      });
    }

    return apiError('Unsupported action', 400);
  } catch (error) {
    logger.error('Error in academic supervisor mutation:', error);
    return apiError('Internal Server Error', 500);
  }
}

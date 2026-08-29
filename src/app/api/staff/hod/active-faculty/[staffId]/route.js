import { db } from '@/db';
import { 
  staffAccounts, 
  staffAccountRoles, 
  staffRoles,
  staffAcademicAffiliations,
  academicDepartments,
  auditLogs,
  userSessions,
  refreshTokens
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { apiResponse, apiError, wrapHandler } from '@/lib/api-utils';
import { z } from 'zod';
import logger from '@/lib/logger';

const patchSchema = z.object({
  action: z.enum(['disable', 'enable'])
});

export const PATCH = wrapHandler({
  auth: 'hod',
  schema: patchSchema,
  handler: async (_request, { user, data, params }) => {
    try {
      const targetStaffId = parseInt(params.staffId, 10);
      if (isNaN(targetStaffId)) {
        return apiError('Invalid staff ID', 400);
      }

      const { action } = data;

      if (!user.hod_department_code) {
        return apiError('Unauthorized - Active HOD Assignment Required', 403);
      }

      // Verify the target belongs to the HOD's department and has FACULTY role
      const targetFacultyRows = await db.select({
        id: staffAccounts.id,
        account_status: staffAccounts.account_status,
        role_code: staffRoles.role_code
      })
      .from(staffAccounts)
      .innerJoin(staffAccountRoles, eq(staffAccountRoles.staff_account_id, staffAccounts.id))
      .innerJoin(staffRoles, eq(staffAccountRoles.role_id, staffRoles.id))
      .innerJoin(staffAcademicAffiliations, eq(staffAcademicAffiliations.staff_account_id, staffAccounts.id))
      .innerJoin(academicDepartments, eq(staffAcademicAffiliations.department_id, academicDepartments.id))
      .where(and(
        eq(staffAccounts.id, targetStaffId),
        eq(academicDepartments.department_code, user.hod_department_code)
      ));

      if (targetFacultyRows.length === 0) {
        return apiError('Faculty not found in your department', 404);
      }

      // Check if target has ADMIN role
      const hasAdmin = targetFacultyRows.some(r => r.role_code === 'ADMIN');
      if (hasAdmin) {
        return apiError('Cannot modify ADMIN accounts', 403);
      }

      // Must have FACULTY role
      const hasFaculty = targetFacultyRows.some(r => r.role_code === 'FACULTY');
      if (!hasFaculty) {
        return apiError('Target staff must have FACULTY role', 403);
      }

      const currentStatus = targetFacultyRows[0].account_status;
      let newStatus = null;

      if (action === 'disable') {
        if (currentStatus === 'SUSPENDED') {
          return apiError('Cannot disable a suspended account. Admin override required.', 403);
        }
        if (currentStatus === 'PENDING_ACTIVATION') {
          return apiError('Cannot disable an unactivated account.', 403);
        }
        if (currentStatus === 'DISABLED') {
          return apiError('Account is already disabled.', 400);
        }
        newStatus = 'DISABLED';
      } else if (action === 'enable') {
        if (currentStatus === 'SUSPENDED') {
          return apiError('Cannot enable a suspended account. Admin override required.', 403);
        }
        if (currentStatus === 'PENDING_ACTIVATION') {
          return apiError('Cannot enable an unactivated account.', 403);
        }
        if (currentStatus === 'ACTIVE') {
          return apiError('Account is already active.', 400);
        }
        newStatus = 'ACTIVE';
      }

      if (!newStatus) {
        return apiError('Invalid transition state', 400);
      }

      // Perform updates
      await db.transaction(async (tx) => {
        await tx.update(staffAccounts)
          .set({ account_status: newStatus })
          .where(eq(staffAccounts.id, targetStaffId));

        if (newStatus === 'DISABLED') {
          // Revoke sessions
          await tx.delete(userSessions).where(and(
            eq(userSessions.user_id, targetStaffId), 
            eq(userSessions.user_type, 'STAFF')
          ));
          await tx.delete(refreshTokens).where(and(
            eq(refreshTokens.user_id, targetStaffId.toString()), 
            eq(refreshTokens.user_type, 'staff')
          ));
        }

        // Audit Log
        await tx.insert(auditLogs).values({
          action: 'STAFF_STATUS_UPDATE',
          user_id: user.id,
          user_type: 'staff',
          target_id: targetStaffId.toString(),
          target_type: 'staff_accounts',
          payload_after: {
            previous_status: currentStatus,
            new_status: newStatus,
            managed_by_hod_dept: user.hod_department_code
          },
          ip_address: _request.headers.get('x-forwarded-for') || '127.0.0.1'
        });
      });

      return apiResponse({ 
        message: `Account successfully ${action}d.`,
        data: {
          staff_id: targetStaffId,
          account_status: newStatus
        }
      });
    } catch (error) {
      logger.error('HOD Faculty Status PATCH Error:', error);
      return apiError('Internal Server Error', 500);
    }
  }
});

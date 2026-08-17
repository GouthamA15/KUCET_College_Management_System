import logger from '@/lib/logger';
import { db } from '@/db';
import { staffAccounts, staffAcademicAffiliations, academicDepartments } from '@/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser, logAudit } from '@/lib/api-utils';
import { staffSchema } from '@/lib/validations/staff';
import { z } from 'zod';

export async function DELETE(req, context) {
  const user = await getAuthUser('admin');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const params = await context.params;
    const idNum = parseInt(params.id);

    const staffBefore = await db.query.staffAccounts.findFirst({
      where: eq(staffAccounts.id, idNum)
    });

    if (!staffBefore) {
      return apiError('Staff not found', 404);
    }

    const [result] = await db.delete(staffAccounts).where(eq(staffAccounts.id, idNum));

    if (result.affectedRows === 0) {
      return apiError('Failed to delete staff account', 500);
    }

    // Audit Log
    await logAudit(req, {
      userId: user.id,
      userType: 'admin',
      action: 'HARD_DELETE_STAFF',
      targetId: idNum,
      targetType: 'staff_accounts',
      before: staffBefore
    });

    return apiResponse({ message: 'Staff account permanently deleted' });
  } catch (error) {
    logger.error('Error deleting staff:', error);
    if (error && error.code === 'ER_ROW_IS_REFERENCED_2') {
      return apiError('Cannot delete this staff member because they have associated records (e.g., student imports, audits). Please deactivate the account instead.', 409);
    }
    return apiError('Internal Server Error', 500);
  }
}

export async function PUT(req, context) {
  const user = await getAuthUser('admin');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const params = await context.params;
    const idNum = parseInt(params.id);
    const json = await req.json();

    // Validate with Zod
    const updateSchema = staffSchema.extend({
      is_active: z.boolean().default(true),
      employee_id: z.string().trim().min(1).max(50)
    }).partial();

    const validatedData = updateSchema.parse(json);
    const { name, email, employee_id, role, is_hod, branch, is_active } = validatedData;

    const staffBefore = await db.query.staffAccounts.findFirst({
      where: eq(staffAccounts.id, idNum)
    });

    if (!staffBefore) {
      return apiError('Staff not found', 404);
    }

    await db.transaction(async (tx) => {
      // 1. Update Staff Accounts
      const updatePayload = {};
      if (name !== undefined) updatePayload.name = name;
      if (email !== undefined) updatePayload.email = email.toLowerCase();
      if (employee_id !== undefined) updatePayload.employee_id = employee_id;
      if (is_active !== undefined) updatePayload.account_status = is_active ? 'ACTIVE' : 'INACTIVE';
      
      if (Object.keys(updatePayload).length > 0) {
        await tx.update(staffAccounts).set(updatePayload).where(eq(staffAccounts.id, idNum));
      }

      // 2. Handle Branch and HOD Updates (for Faculty)
      // Only do this if branch or is_hod is explicitly passed
      if (is_hod !== undefined || branch !== undefined) {
        let deptId = null;
        if (branch) {
          const dept = await tx.query.academicDepartments.findFirst({ where: eq(academicDepartments.code, branch) });
          if (dept) deptId = dept.id;
        }

        // STRICT VALIDATION: Only one HOD per branch
        if (is_hod && deptId) {
          const existingHODRows = await tx.select({ id: staffAccounts.id, name: staffAccounts.name })
            .from(staffAcademicAffiliations)
            .innerJoin(staffAccounts, eq(staffAcademicAffiliations.staff_account_id, staffAccounts.id))
            .where(and(
              eq(staffAcademicAffiliations.department_id, deptId),
              eq(staffAcademicAffiliations.is_hod, true),
              eq(staffAccounts.account_status, 'ACTIVE'),
              ne(staffAccounts.id, idNum)
            ))
            .limit(1);

          if (existingHODRows.length > 0) {
            throw new Error(`Conflict: ${existingHODRows[0].name} is already the HOD for ${branch}. Please demote them first.`);
          }
        }

        // Check if affiliation exists
        const existingAffil = await tx.query.staffAcademicAffiliations.findFirst({
          where: eq(staffAcademicAffiliations.staff_account_id, idNum)
        });

        if (existingAffil) {
           const affilPayload = {};
           if (is_hod !== undefined) affilPayload.is_hod = !!is_hod;
           if (deptId !== null) affilPayload.department_id = deptId;
           
           if (Object.keys(affilPayload).length > 0) {
             await tx.update(staffAcademicAffiliations)
               .set(affilPayload)
               .where(eq(staffAcademicAffiliations.id, existingAffil.id));
           }
        } else if (deptId !== null) {
           await tx.insert(staffAcademicAffiliations).values({
             staff_account_id: idNum,
             department_id: deptId,
             is_hod: !!is_hod
           });
        }
      }
    });

    // Audit Log
    await logAudit(req, {
      userId: user.id,
      userType: 'admin',
      action: 'UPDATE_CLERK',
      targetId: idNum,
      targetType: 'staff_accounts',
      before: staffBefore,
      after: { name, email, employee_id, role, is_hod, branch, is_active }
    });

    return apiResponse({ message: 'Staff updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.errors?.[0]?.message || 'Invalid input data', 400);
    }
    if (error.message && error.message.startsWith('Conflict:')) {
      return apiError(error.message, 400);
    }
    logger.error('Error updating staff:', error);
    if (error && error.code === 'ER_DUP_ENTRY') {
      return apiError('Email or Employee ID already exists', 409);
    }
    return apiError('Internal Server Error', 500);
  }
}


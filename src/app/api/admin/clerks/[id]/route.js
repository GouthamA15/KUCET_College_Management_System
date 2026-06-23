import logger from '@/lib/logger';
import { db } from '@/db';
import { clerks } from '@/db/schema';
import { eq, and, ne, _sql } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser, logAudit } from '@/lib/api-utils';
import { clerkSchema } from '@/lib/validations/staff';
import { z } from 'zod';

export async function DELETE(req, context) {
  const user = await getAuthUser('admin');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const params = await context.params;
    const idNum = parseInt(params.id);

    const clerkBefore = await db.query.clerks.findFirst({
      where: eq(clerks.id, idNum)
    });

    if (!clerkBefore) {
      return apiError('Clerk not found', 404);
    }

    const [result] = await db.update(clerks).set({ is_active: false }).where(eq(clerks.id, idNum));

    if (result.affectedRows === 0) {
      return apiError('Failed to delete clerk', 500);
    }

    // Audit Log
    await logAudit(req, {
      userId: user.id,
      userType: 'admin',
      action: 'DELETE_CLERK',
      targetId: idNum,
      targetType: 'clerk',
      before: clerkBefore
    });

    return apiResponse({ message: 'Clerk deleted successfully' });
  } catch (error) {
    logger.error('Error deleting clerk:', error);
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
    const updateSchema = clerkSchema.extend({
      is_active: z.boolean().default(true),
      employee_id: z.string().trim().min(1).max(50)
    }).partial();

    const validatedData = updateSchema.parse(json);
    const { name, email, employee_id, role, is_hod, branch, is_active } = validatedData;

    const clerkBefore = await db.query.clerks.findFirst({
      where: eq(clerks.id, idNum)
    });

    if (!clerkBefore) {
      return apiError('Clerk not found', 404);
    }

    // STRICT VALIDATION: Only one HOD per branch
    if (is_hod && branch && is_active !== false) {
      const existingHOD = await db.select({ id: clerks.id, name: clerks.name })
        .from(clerks)
        .where(and(
          eq(clerks.branch, branch),
          eq(clerks.is_hod, true),
          eq(clerks.is_active, true),
          ne(clerks.id, idNum)
        ))
        .limit(1);

      if (existingHOD.length > 0) {
        return apiError(
          `Conflict: ${existingHOD[0].name} is already the HOD for ${branch}. Please demote them first.`,
          400
        );
      }
    }

    const updatePayload = { /* empty */ };
    if (name !== undefined) updatePayload.name = name;
    if (email !== undefined) updatePayload.email = email.toLowerCase();
    if (employee_id !== undefined) updatePayload.employee_id = employee_id;
    if (role !== undefined) updatePayload.role = role;
    if (is_hod !== undefined) updatePayload.is_hod = !!is_hod;
    if (branch !== undefined) updatePayload.branch = branch || null;
    if (is_active !== undefined) updatePayload.is_active = !!is_active;

    const [result] = await db.update(clerks)
      .set(updatePayload)
      .where(eq(clerks.id, idNum));

    if (result.affectedRows === 0) {
      return apiError('Failed to update clerk', 500);
    }

    // Audit Log
    await logAudit(req, {
      userId: user.id,
      userType: 'admin',
      action: 'UPDATE_CLERK',
      targetId: idNum,
      targetType: 'clerk',
      before: clerkBefore,
      after: updatePayload
    });

    return apiResponse({ message: 'Clerk updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.errors?.[0]?.message || 'Invalid input data', 400);
    }
    logger.error('Error updating clerk:', error);
    if (error && error.code === 'ER_DUP_ENTRY') {
      return apiError('Email or Employee ID already exists', 409);
    }
    return apiError('Internal Server Error', 500);
  }
}

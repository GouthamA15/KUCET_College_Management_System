import { db } from '@/db';
import { clerks } from '@/db/schema';
import { eq, and, ne, sql } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function DELETE(req, context) {
  const user = await getAuthUser('admin');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const { id } = await context.params;
    const idNum = parseInt(id);

    const [result] = await db.delete(clerks).where(eq(clerks.id, idNum));

    if (result.affectedRows === 0) {
      return apiError('Clerk not found', 404);
    }

    return apiResponse({ message: 'Clerk deleted successfully' });
  } catch (error) {
    console.error('Error deleting clerk:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function PUT(req, context) {
  const user = await getAuthUser('admin');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const { id } = await context.params;
    const idNum = parseInt(id);
    const body = await req.json();
    const { name, email, employee_id, role, is_hod, branch, is_active } = body;

    // STRICT VALIDATION: Only one HOD per branch
    if (is_hod && branch && is_active) {
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

    const [result] = await db.update(clerks)
      .set({ name, email, employee_id, role, is_hod, branch, is_active })
      .where(eq(clerks.id, idNum));

    if (result.affectedRows === 0) {
      return apiError('Clerk not found', 404);
    }

    return apiResponse({ message: 'Clerk updated successfully' });
  } catch (error) {
    console.error('Error updating clerk:', error);
    if (error && error.code === 'ER_DUP_ENTRY') {
      return apiError('Email or Employee ID already exists', 409);
    }
    return apiError('Internal Server Error', 500);
  }
}

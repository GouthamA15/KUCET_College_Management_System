import { query } from '@/lib/db';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function DELETE(req, context) {
  const user = await getAuthUser('admin');

  if (!user) {
    return apiError('Unauthorized', 401);
  }

  const { id } = await context.params;

  try {
    const result = await query('DELETE FROM clerks WHERE id = ?', [id]);

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

  if (!user) {
    return apiError('Unauthorized', 401);
  }

  const { id } = await context.params;

  try {
    const { name, email, employee_id, role, is_hod, branch, is_active } = await req.json();

    // STRICT VALIDATION: Only one HOD per branch
    if (is_hod && branch && is_active) {
      const existingHOD = await query(
        'SELECT id, name FROM clerks WHERE branch = ? AND is_hod = 1 AND is_active = 1 AND id != ?',
        [branch, id]
      );

      if (existingHOD.length > 0) {
        return apiError(
          `Conflict: ${existingHOD[0].name} is already the HOD for ${branch}. Please demote them first.`,
          400
        );
      }
    }

    const result = await query(
      'UPDATE clerks SET name = ?, email = ?, employee_id = ?, role = ?, is_hod = ?, branch = ?, is_active = ? WHERE id = ?',
      [name, email, employee_id, role, is_hod, branch, is_active, id]
    );

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

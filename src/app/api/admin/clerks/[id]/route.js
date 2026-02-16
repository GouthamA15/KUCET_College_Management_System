import { query } from '@/lib/db';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function DELETE(req, context) {
  const user = await getAuthUser('admin');

  if (!user) {
    return apiError('Unauthorized', 401);
  }

  try {
    const params = await context.params;
    const { id } = params;
    const result = await query('DELETE FROM clerks WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return apiError('Clerk not found', 404);
    }

    return apiResponse({ success: true, message: 'Clerk deleted successfully' });
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

  try {
    const params = await context.params;
    const { id } = params;
    const { name, email, employee_id, role, is_active } = await req.json();

    const result = await query(
      'UPDATE clerks SET name = ?, email = ?, employee_id = ?, role = ?, is_active = ? WHERE id = ?',
      [name, email, employee_id, role, is_active, id]
    );

    if (result.affectedRows === 0) {
      return apiError('Clerk not found', 404);
    }

    return apiResponse({ success: true, message: 'Clerk updated successfully' });
  } catch (error) {
    console.error('Error updating clerk:', error);
    if (error && error.code === 'ER_DUP_ENTRY') {
      return apiError('Email or Employee ID already exists', 409);
    }
    return apiError('Internal Server Error', 500);
  }
}

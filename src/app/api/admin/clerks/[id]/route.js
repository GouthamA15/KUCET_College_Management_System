import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function PUT(req, context) {
  try {
    const params = await context.params;
    const { id } = params;
    const { name, email, employee_id, role, is_active } = await req.json();

    const result = await query(
      'UPDATE clerks SET name = ?, email = ?, employee_id = ?, role = ?, is_active = ? WHERE id = ?',
      [name, email, employee_id, role, is_active, id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Clerk not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Clerk updated successfully' });
  } catch (error) {
    console.error('Error updating clerk:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: 'Email or Employee ID already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req, context) {
  try {
    const params = await context.params;
    const { id } = params;
    const result = await query('DELETE FROM clerks WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Clerk not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Clerk deleted successfully' });
  } catch (error) {
    console.error('Error deleting clerk:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
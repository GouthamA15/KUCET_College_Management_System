import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Clerk ID is required' }, { status: 400 });
    }

    const result = await query('DELETE FROM clerk WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Clerk not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: `Clerk with ID ${id} deleted successfully` });
  } catch (error) {
    console.error(`Error deleting clerk with ID ${(await params).id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const { name, email, employee_id, is_active } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Clerk ID is required' }, { status: 400 });
    }

    // Dynamic query building could be better, but we'll stick to a simple update for now
    // assuming all fields are sent or at least handled. 
    // Ideally, we should check what fields are present.
    
    // For now, let's assume we want to update name, email, employee_id and is_active.
    // If password update is needed, it should probably be a separate route or handled carefully.

    const result = await query(
      'UPDATE clerk SET name = ?, email = ?, employee_id = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, email, employee_id, is_active, id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Clerk not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Clerk updated successfully' });
  } catch (error) {
    console.error(`Error updating clerk with ID ${(await params).id}:`, error);
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: 'Email or Employee ID already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

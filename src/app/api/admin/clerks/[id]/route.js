import { query } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

// Helper function to verify JWT using jose (Edge compatible)   
async function verifyJwt(token, secret) {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    console.error('JWT Verification failed:', error);
    return null;
  }
}
export async function DELETE(req, context) {
  const cookieStore = await cookies();
  const adminAuthCookie = cookieStore.get('admin_auth');
  const token = adminAuthCookie ? adminAuthCookie.value : null;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const decoded = await verifyJwt(token, process.env.JWT_SECRET);
  if (!decoded || decoded.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

export async function PUT(req, context) {
  const cookieStore = await cookies();
  const adminAuthCookie = cookieStore.get('admin_auth');
  const token = adminAuthCookie ? adminAuthCookie.value : null;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const decoded = await verifyJwt(token, process.env.JWT_SECRET);
  if (!decoded || decoded.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      return NextResponse.json({ error: 'Clerk not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Clerk updated successfully' });
  } catch (error) {
    console.error('Error updating clerk:', error);
    if (error && error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: 'Email or Employee ID already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

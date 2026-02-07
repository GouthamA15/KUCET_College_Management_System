import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { query } from '@/lib/db';

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

export async function GET(req) {
  const cookieStore = await cookies();
  const token = cookieStore.get('clerk_auth')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const decoded = await verifyJwt(token, process.env.JWT_SECRET);
  if (!decoded) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows = await query('SELECT id, name, email, role, employee_id FROM clerks WHERE id = ?', [decoded.clerkId]);
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Clerk not found' }, { status: 404 });
    }
    const clerk = rows[0];
    return NextResponse.json(clerk);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

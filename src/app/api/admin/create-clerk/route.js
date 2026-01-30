import { query } from '@/lib/db';
import bcrypt from 'bcrypt';
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

export async function POST(req) {
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
    const { name, email, password, employee_id, role } = await req.json();

    if (!name || !email || !password || !employee_id || !role) {
      return new Response(JSON.stringify({ error: 'Name, email, password, employee_id, and role are required' }), { status: 400 });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const result = await query(
      'INSERT INTO clerks (name, email, password_hash, employee_id, role) VALUES (?, ?, ?, ?, ?)',
      [name, email, passwordHash, employee_id, role]
    );

    return new Response(JSON.stringify({ success: true, clerkId: result.insertId }), { status: 201 });
  } catch (error) {
    console.error('Error creating clerk:', error);
    // Check for duplicate entry error
    if (error.code === 'ER_DUP_ENTRY') {
      return new Response(JSON.stringify({ error: 'Email already exists' }), { status: 409 });
    }
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}
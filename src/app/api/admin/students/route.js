import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
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

export async function GET(request) {
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

  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year');
  const branch = searchParams.get('branch');

  if (!year || !branch) {
    return NextResponse.json({ error: 'Year and branch are required' }, { status: 400 });
  }

  try {
    const studentsQuery = 'SELECT * FROM students WHERE roll_no LIKE ?';
    // This is a simplified logic. You might need a more robust way to determine the roll number pattern
    const rollNumberPattern = `${year.slice(-2)}%T${branch}%`; 
    const students = await query(studentsQuery, [rollNumberPattern]);

    return NextResponse.json({ students });
  } catch (error) {
    console.error('Failed to fetch students:', error);
    return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 });
  }
}
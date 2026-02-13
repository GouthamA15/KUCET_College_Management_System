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

export async function GET(request, { params }) {
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

  const { rollno } = await params;

  if (!rollno) {
    return NextResponse.json({ error: 'Roll number is required' }, { status: 400 });
  }

  try {
    const studentQuery = `
      SELECT s.*, CASE WHEN si.pfp IS NOT NULL THEN 1 ELSE 0 END as has_pfp 
      FROM students s 
      LEFT JOIN student_images si ON s.id = si.student_id 
      WHERE s.roll_no = ?`;
    const [student] = await query(studentQuery, [rollno]);

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    if (student.has_pfp) {
        student.pfp = `/api/student/image/${student.roll_no}`;
    } else {
        student.pfp = null;
    }
    delete student.has_pfp;

    return NextResponse.json({ student });
  } catch (error) {
    console.error('Failed to fetch student:', error);
    return NextResponse.json({ error: 'Failed to fetch student' }, { status: 500 });
  }
}
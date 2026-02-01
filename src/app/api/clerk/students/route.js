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

export async function GET(req) {
  const cookieStore = await cookies();
  const clerkAuthCookie = cookieStore.get('clerk_auth');
  const token = clerkAuthCookie ? clerkAuthCookie.value : null;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const decoded = await verifyJwt(token, process.env.JWT_SECRET);
  if (!decoded) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const year = req.nextUrl.searchParams.get('year');
    const branch = req.nextUrl.searchParams.get('branch');

    if (!year || !branch) {
      return NextResponse.json({ message: 'Year and branch are required' }, { status: 400 });
    }

    const yearShort = year.slice(-2);

    const regularRollPattern = `${yearShort}567T${branch}%`;
    const lateralRollPattern = `${yearShort}567${branch}%L`;

    const sql = `
      SELECT * FROM students
      WHERE 
        roll_no LIKE ? OR roll_no LIKE ?
    `;

    const students = await query(sql, [regularRollPattern, lateralRollPattern]);

    return NextResponse.json({ students });
  } catch (error) {
    console.error('Error fetching students:', error);
    return NextResponse.json({ message: 'Failed to fetch students', error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  const cookieStore = cookies();
  const clerkAuthCookie = cookieStore.get('clerk_auth');
  const token = clerkAuthCookie ? clerkAuthCookie.value : null;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const decoded = await verifyJwt(token, process.env.JWT_SECRET);
  if (!decoded) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await req.json();
    const {
      admission_no,
      roll_no,
      name,
      father_name,
      mother_name,
      date_of_birth,
      gender,
      religion,
      caste,
      sub_caste,
      category,
      address,
      mobile,
      email,
      qualifying_exam,
      scholarship_status,
      fee_payment_details,
    } = data;

    const sql = `
      INSERT INTO students (
        admission_no, roll_no, name, father_name, mother_name, date_of_birth,
        gender, religion, caste, sub_caste, category, address,
        mobile, email, qualifying_exam,
        scholarship_status, fee_payment_details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      admission_no,
      roll_no,
      name,
      father_name,
      mother_name,
      date_of_birth,
      gender,
      religion,
      caste,
      sub_caste,
      category,
      address,
      mobile,
      email,
      qualifying_exam,
      scholarship_status,
      fee_payment_details,
    ];

    await query(sql, params);

    return NextResponse.json({ message: 'Student added successfully' }, { status: 201 });
  } catch (error) {
    console.error('Error adding student:', error);
    return NextResponse.json({ message: 'Failed to add student', error: error.message }, { status: 500 });
  }
}

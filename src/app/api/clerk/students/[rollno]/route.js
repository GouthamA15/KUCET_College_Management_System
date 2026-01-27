import { query } from '@/lib/db';
import { toMySQLDate } from '@/lib/date';
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

export async function GET(req, context) {
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
    const params = await context.params;
    const { rollno } = params;
    if (!rollno) {
      return NextResponse.json({ error: 'Roll number is required' }, { status: 400 });
    }

    const rows = await query('SELECT * FROM students WHERE roll_no = ?', [rollno]);

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }
    return NextResponse.json({ student: rows[0] });
  } catch (err) {
    console.error('Fetch Student Error:', err);
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}

export async function PUT(req, context) {
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
    const params = await context.params;
    const { rollno } = params;
    const body = await req.json();
    const { name, gender, mobile, email, date_of_birth, course } = body;

    if (!rollno) {
      return NextResponse.json({ error: 'Roll number is required' }, { status: 400 });
    }

    const checkRows = await query('SELECT roll_no FROM students WHERE roll_no = ?', [rollno]);
    if (checkRows.length === 0) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Build dynamic update for only allowed students columns
    const updates = [];
    const paramsArr = [];
    if (typeof name !== 'undefined') { updates.push('name = ?'); paramsArr.push(name === '' ? null : name); }
    if (typeof gender !== 'undefined') { updates.push('gender = ?'); paramsArr.push(gender === '' ? null : gender); }
    if (typeof mobile !== 'undefined') { updates.push('mobile = ?'); paramsArr.push(mobile === '' ? null : mobile); }
    if (typeof email !== 'undefined') { updates.push('email = ?'); paramsArr.push(email === '' ? null : email); }
    if (typeof date_of_birth !== 'undefined') { updates.push('date_of_birth = ?'); paramsArr.push(date_of_birth === '' ? null : toMySQLDate(date_of_birth)); }
    if (typeof course !== 'undefined') { updates.push('course = ?'); paramsArr.push(course === '' ? null : course); }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
    }

    const sql = `UPDATE students SET ${updates.join(', ')} WHERE roll_no = ?`;
    const result = await query(sql, [...paramsArr, rollno]);

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'No changes made or update failed' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Student details updated successfully' });
  } catch (err) {
    console.error('Update Student Error:', err);
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}
import { query } from '@/lib/db';
import { toMySQLDate } from '@/lib/date';
import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import bcrypt from'bcrypt'

export async function POST(req) {
  try {
    const body = await req.json();
    const { rollno, dob } = body; //dob used as password input field
    if (!rollno || !dob) {
      return NextResponse.json({ error: 'Missing rollno or dob' }, { status: 400 });
    }
    
    const rows = await query(
      `SELECT s.roll_no, s.name, sp.father_name, sp.category, s.mobile, s.date_of_birth, s.password_hash
       FROM students s
       LEFT JOIN student_personal_details sp ON s.id = sp.student_id
       WHERE s.roll_no = ?`,
      [rollno]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const student = rows[0];
    let isAuthenticated = false

    // 1. CHECK PASSWORD (If set)
    if (student.password_hash) {
      // The user entered a password in the 'dob' field
      const match = await bcrypt.compare(dob, student.password_hash);
      if (match) {
        isAuthenticated = true;
      } else {
        return NextResponse.json({ error: 'Invalid Password' }, { status: 401 });
      }
    }
    else {
    const dobInputMySQL = toMySQLDate(dob);

    const dbDate = new Date(student.date_of_birth);
    const dbDateString = dbDate.getFullYear() + '-' + String(dbDate.getMonth() + 1).padStart(2, '0') + '-' + String(dbDate.getDate()).padStart(2, '0');
    // Helper: Normalize Input to YYYY-MM-DD
      // This handles if frontend sends "15-08-2005" OR "2005-08-15"
      let inputDateString = dob;
      if (dob.includes('-')) {
        const parts = dob.split('-');
        if (parts[0].length === 2 && parts[2].length === 4) {
           // It's DD-MM-YYYY -> Convert to YYYY-MM-DD
           inputDateString = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }

    if (dbDateString === inputDateString) {
        isAuthenticated = true;
      } else {
        return NextResponse.json({ error: 'Invalid Date of Birth' }, { status: 401 });
      }
    }

    if (!isAuthenticated) {
        return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }
    
    const { date_of_birth: _dob, password_hash = _ph, ...profile } = student;

    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const token = await new SignJWT({ student_id: student.id, roll_no: student.roll_no, name: student.name })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(secret);

    const response = NextResponse.json({ student: profile, success: true }, { status: 200 });

    // Clear other auth cookies
    response.cookies.delete('admin_auth');
    response.cookies.delete('clerk_auth');

    response.cookies.set('student_auth', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60, // 1 hour
        path: '/',
    });
    return response;

  } catch (err) {
     console.error(err)
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}

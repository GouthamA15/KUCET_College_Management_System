import { query } from '@/lib/db';
import { toMySQLDate } from '@/lib/date';
import { NextResponse } from 'next/server'; // Import NextResponse

export async function POST(req) {
  try {
    const body = await req.json();
    const { rollno, dob } = body;
    if (!rollno || !dob) {
      return NextResponse.json({ error: 'Missing rollno or dob' }, { status: 400 });
    }
    
    const rows = await query(
      `SELECT s.roll_no, s.name, sp.father_name, sp.category, s.mobile, s.date_of_birth
       FROM students s
       LEFT JOIN student_personal_details sp ON s.id = sp.student_id
       WHERE s.roll_no = ?`,
      [rollno]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const student = rows[0];

    const dobInputMySQL = toMySQLDate(dob);

    // Convert database date to YYYY-MM-DD string for comparison
    const dbDate = new Date(student.date_of_birth);
    const dbDateString = dbDate.getFullYear() + '-' + String(dbDate.getMonth() + 1).padStart(2, '0') + '-' + String(dbDate.getDate()).padStart(2, '0');

    if (dbDateString !== dobInputMySQL) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    const { date_of_birth: _dob, ...profile } = student;
    
    // Set a student authentication cookie upon successful login
    const response = NextResponse.json({ student: profile, success: true }, { status: 200 });
    response.cookies.set('student_auth', 'true', {
        httpOnly: true,
        secure: process.env.NODE_.ENV === 'production',
        maxAge: 60 * 60, // 1 hour
        path: '/',
    });
    return response;

  } catch (err) {
     console.error(err)
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}

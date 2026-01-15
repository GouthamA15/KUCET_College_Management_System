export async function GET(req, { params }) {
  try {
    const { rollno } = await params;
    if (!rollno) {
      return NextResponse.json({ error: 'Roll number is required' }, { status: 400 });
    }
    const db = getDb();
    // Use prepared statement for safety
    const [rows] = await db.execute('SELECT * FROM cse_students WHERE rollno = ?', [rollno]);
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }
    return NextResponse.json({ student: rows[0] });
  } catch (err) {
    console.error('Fetch Student Error:', err);
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}
import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function PUT(req, { params }) {
  try {
    const { rollno } = await params;
    const body = await req.json();
    const { student_name, father_name, gender, category, phone_no, dob } = body;

    if (!rollno) {
      return NextResponse.json({ error: 'Roll number is required' }, { status: 400 });
    }

    const db = getDb();

    // Check if student exists first
    const [checkRows] = await db.execute('SELECT rollno FROM cse_students WHERE rollno = ?', [rollno]);
    if (checkRows.length === 0) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Update query
    const [result] = await db.execute(
      `UPDATE cse_students 
       SET student_name = ?, father_name = ?, gender = ?, category = ?, phone_no = ?, dob = ? 
       WHERE rollno = ?`,
      [student_name, father_name, gender, category, phone_no, dob, rollno]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'No changes made or update failed' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Student details updated successfully' });
  } catch (err) {
    console.error('Update Student Error:', err);
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}

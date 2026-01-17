import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req, context) {
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
  try {
    const params = await context.params;
    const { rollno } = params;
    const body = await req.json();
    const { name, father_name, gender, category, mobile, date_of_birth } = body;

    if (!rollno) {
      return NextResponse.json({ error: 'Roll number is required' }, { status: 400 });
    }

    const checkRows = await query('SELECT roll_no FROM students WHERE roll_no = ?', [rollno]);
    if (checkRows.length === 0) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const result = await query(
      `UPDATE students 
       SET name = ?, father_name = ?, gender = ?, category = ?, mobile = ?, date_of_birth = ? 
       WHERE roll_no = ?`,
      [name, father_name, gender, category, mobile, date_of_birth, rollno]
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

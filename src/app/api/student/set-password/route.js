import { query } from '@/lib/db';
import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';

// GET: Check if password is set
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const rollno = searchParams.get('rollno');

    if (!rollno) return NextResponse.json({ error: 'Roll number required' }, { status: 400 });

    const rows = await query(
      'SELECT password_hash FROM students WHERE roll_no = ?',
      [rollno]
    );

    if (rows.length === 0) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

    const isPasswordSet = !!rows[0].password_hash;

    return NextResponse.json({ isPasswordSet }, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST: Set new password
export async function POST(req) {
  try {
    const body = await req.json();
    const { rollno, password } = body;

    if (!rollno || !password) {
      return NextResponse.json({ error: 'Missing details' }, { status: 400 });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    await query(
      'UPDATE students SET password_hash = ? WHERE roll_no = ?',
      [hashedPassword, rollno]
    );

    return NextResponse.json({ success: true, message: 'Password set successfully' }, { status: 200 });
  } catch (err) {
    console.error('Password set error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
import { query } from '@/lib/db';
import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import * as nextHeaders from 'next/headers';
import { verifyJwt } from '@/lib/auth';

export async function POST(req) {
  try {
    const token = (await nextHeaders.cookies()).get('student_auth')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await verifyJwt(token, process.env.JWT_SECRET);

    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { oldPassword, newPassword } = await req.json();

    const [student] = await query('SELECT password_hash FROM students WHERE roll_no = ?', [decoded.roll_no]);

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const match = await bcrypt.compare(oldPassword, student.password_hash);

    if (!match) {
      return NextResponse.json({ error: 'Invalid old password' }, { status: 400 });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await query('UPDATE students SET password_hash = ? WHERE roll_no = ?', [hashedPassword, decoded.roll_no]);

    return NextResponse.json({ message: 'Password changed successfully' }, { status: 200 });
  } catch (error) {
    console.error('CHANGE PASSWORD ERROR:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

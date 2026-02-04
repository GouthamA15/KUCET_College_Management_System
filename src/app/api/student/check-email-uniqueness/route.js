import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const currentRollno = searchParams.get('currentRollno'); // Optional: student's own rollno

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    let queryString = `SELECT roll_no FROM students WHERE email = ?`;
    let queryParams = [email];

    // If currentRollno is provided, exclude the student's own email from the check
    if (currentRollno) {
      queryString += ` AND roll_no != ?`;
      queryParams.push(currentRollno);
    }

    const rows = await query(queryString, queryParams);

    if (rows.length > 0) {
      return NextResponse.json({ isUnique: false, message: 'This email is already registered to another student.' }, { status: 200 });
    }

    return NextResponse.json({ isUnique: true, message: 'Email is available.' }, { status: 200 });
  } catch (error) {
    console.error('Error checking email uniqueness:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

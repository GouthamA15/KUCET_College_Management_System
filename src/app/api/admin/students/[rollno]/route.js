import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request, { params }) {
  const { rollno } = await params;

  if (!rollno) {
    return NextResponse.json({ error: 'Roll number is required' }, { status: 400 });
  }

  try {
    const studentQuery = 'SELECT * FROM students WHERE roll_no = ?';
    const [student] = await query(studentQuery, [rollno]);

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    return NextResponse.json({ student });
  } catch (error) {
    console.error('Failed to fetch student:', error);
    return NextResponse.json({ error: 'Failed to fetch student' }, { status: 500 });
  }
}

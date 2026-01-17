import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year');
  const branch = searchParams.get('branch');

  if (!year || !branch) {
    return NextResponse.json({ error: 'Year and branch are required' }, { status: 400 });
  }

  try {
    const studentsQuery = 'SELECT * FROM students WHERE roll_no LIKE ?';
    // This is a simplified logic. You might need a more robust way to determine the roll number pattern
    const rollNumberPattern = `${year.slice(-2)}%T${branch}%`; 
    const students = await query(studentsQuery, [rollNumberPattern]);

    return NextResponse.json({ students });
  } catch (error) {
    console.error('Failed to fetch students:', error);
    return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 });
  }
}

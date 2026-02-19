import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const academic_year = searchParams.get('academic_year');
  const semester = searchParams.get('semester');

  if (!date || !academic_year || !semester) {
    return NextResponse.json({ error: 'Missing required parameters: date, academic_year, semester' }, { status: 400 });
  }

  try {
    const db = await getDb();
    const [rows] = await db.execute(
      'SELECT day_type, holiday_name FROM academic_calendar WHERE date = ? AND academic_year = ? AND semester = ?',
      [date, academic_year, semester]
    );

    if (rows.length === 0) {
      // If no entry exists, it's a non-working day by default for attendance purposes
      return NextResponse.json({ data: { day_type: 'HOLIDAY', holiday_name: 'Not a scheduled academic day' } });
    }

    return NextResponse.json({ data: rows[0] });
  } catch (error) {
    console.error('API_GET_DAY_INFO_ERROR:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

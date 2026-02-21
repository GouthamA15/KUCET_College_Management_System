import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const academic_year = searchParams.get('academic_year');
  const semester = searchParams.get('semester');

  if (!date || !academic_year || !semester) {
    return NextResponse.json(
      { error: 'Missing required parameters: date, academic_year, semester' },
      { status: 400 }
    );
  }

  try {
    const db = await getDb();

    // First, ensure the date falls within the configured academic term window.
    const [semesterRows] = await db.execute(
      'SELECT start_date, end_date FROM semesters WHERE academic_year = ? AND semester = ? LIMIT 1',
      [academic_year, semester]
    );

    if (semesterRows.length === 0) {
      return NextResponse.json(
        { data: { day_type: 'HOLIDAY', holiday_name: 'Academic term not configured for this year/semester' } },
        { status: 200 }
      );
    }

    const { start_date, end_date } = semesterRows[0];
    const dateStr = typeof date === 'string' && date.includes('T') ? date.split('T')[0] : date;
    const startStr = typeof start_date === 'string' && start_date.includes('T') ? start_date.split('T')[0] : start_date;
    const endStr = typeof end_date === 'string' && end_date.includes('T') ? end_date.split('T')[0] : end_date;

    if (!startStr || !endStr || dateStr < startStr || dateStr > endStr) {
      return NextResponse.json(
        { data: { day_type: 'HOLIDAY', holiday_name: 'Date is outside the academic term window' } },
        { status: 200 }
      );
    }

    // Within the term window: look for an explicit calendar entry.
    const [rows] = await db.execute(
      'SELECT day_type, holiday_name FROM academic_calendar WHERE date = ? AND academic_year = ? AND semester = ?',
      [dateStr, academic_year, semester]
    );

    if (rows.length === 0) {
      // No explicit entry => treat as a normal WORKING day.
      return NextResponse.json({ data: { day_type: 'WORKING', holiday_name: null } });
    }

    return NextResponse.json({ data: rows[0] });
  } catch (error) {
    console.error('API_GET_DAY_INFO_ERROR:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

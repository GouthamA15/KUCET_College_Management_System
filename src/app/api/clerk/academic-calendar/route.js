import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getNow } from '@/lib/clock';
import { getAuthUser, apiError } from '@/lib/api-utils';

export async function GET(request) {
  const user = await getAuthUser('clerk');
  if (!user) {
    return apiError('Unauthorized', 401);
  }


  const { searchParams } = new URL(request.url);
  const academic_year = searchParams.get('academic_year');
  const semester = searchParams.get('semester');
  const month = parseInt(searchParams.get('month'), 10);
  const year = parseInt(searchParams.get('year'), 10);

  if (!academic_year || !semester || !month || !year) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  // Compute last day using JS Date, but use pure string dates for DB
  const lastDay = new Date(year, month, 0).getDate();
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  try {
    const db = await getDb();
    const [rows] = await db.execute(
      `SELECT * FROM academic_calendar 
       WHERE academic_year = ? AND semester = ? AND date >= ? AND date <= ?`,
      [academic_year, semester, startDate, endDate]
    );
    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error('API_GET_ACADEMIC_CALENDAR_ERROR:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request) {
    const user = await getAuthUser('clerk');
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    try {
        const body = await request.json();
        let { date, academic_year, semester, day_type, holiday_name } = body;
  
      // Validation
      if (!date || !academic_year || !semester || !day_type) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }
      
      const validDayTypes = ['WORKING', 'HOLIDAY', 'EXAM', 'INTERNAL', 'EVENT'];
      if (!validDayTypes.includes(day_type)) {
          return NextResponse.json({ error: 'Invalid day_type specified' }, { status: 400 });
      }
  
      if (day_type === 'HOLIDAY' && !holiday_name) {
        return NextResponse.json({ error: 'Holiday name is required for holidays.' }, { status: 400 });
      }
  
      if (day_type !== 'HOLIDAY') {
        holiday_name = null;
      }
  
      // Normalize input date to YYYY-MM-DD (strip any time component)
      if (typeof date !== 'string') {
        date = String(date);
      }
      if (date.includes('T')) {
        date = date.split('T')[0];
      }
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      if (!datePattern.test(date)) {
        return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 });
      }

      const now = await getNow();
  
      const db = await getDb();
      const sql = `
        INSERT INTO academic_calendar (date, academic_year, semester, day_type, holiday_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        day_type = VALUES(day_type),
        holiday_name = VALUES(holiday_name),
        updated_at = VALUES(updated_at)
      `;
  
      await db.execute(sql, [date, academic_year, semester, day_type, holiday_name, now, now]);
  
      return NextResponse.json({ message: 'Calendar updated successfully' });
  
    } catch (error) {
      console.error('API_POST_ACADEMIC_CALENDAR_ERROR:', error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  }
  
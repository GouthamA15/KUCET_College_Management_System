import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(request) {
  try {
    const {
      academic_year,
      semester,
      start_date,
      end_date,
      weekend_days
    } = await request.json();

    if (!academic_year || !semester || !start_date || !end_date || !Array.isArray(weekend_days)) {
      return NextResponse.json({ error: 'Missing or invalid required fields' }, { status: 400 });
    }

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    if (startDate > endDate) {
      return NextResponse.json({ error: 'Start date cannot be after end date.' }, { status: 400 });
    }

    const db = await getDb();
    const connection = await db.getConnection(); // Use a connection for transactions
    await connection.beginTransaction();

    try {
      // 0. Upsert into the semesters table
      const upsertSemesterQuery = `
        INSERT INTO semesters (academic_year, semester, start_date, end_date, weekend_pattern, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
        start_date = VALUES(start_date),
        end_date = VALUES(end_date),
        weekend_pattern = VALUES(weekend_pattern),
        updated_at = NOW()
      `;
      await connection.query(upsertSemesterQuery, [
        academic_year,
        semester,
        start_date,
        end_date,
        JSON.stringify(weekend_days)
      ]);

      // 1. Generate all days as WORKING days
      const dates = [];
      let currentDate = new Date(startDate.toISOString().slice(0,10)); // Use UTC date

      while (currentDate <= endDate) {
        dates.push(currentDate.toISOString().slice(0, 10));
        currentDate.setDate(currentDate.getDate() + 1);
      }

      if (dates.length > 0) {
        const insertQuery = `
          INSERT IGNORE INTO academic_calendar (date, academic_year, semester, day_type)
          VALUES ?
        `;
        const values = dates.map(date => [date, academic_year, semester, 'WORKING']);
        await connection.query(insertQuery, [values]);
      }
      
      // 2. Update weekend days to HOLIDAY
      if (weekend_days.length > 0) {
        const dayMap = { 'SUNDAY': 0, 'MONDAY': 1, 'TUESDAY': 2, 'WEDNESDAY': 3, 'THURSDAY': 4, 'FRIDAY': 5, 'SATURDAY': 6 };
        const weekendDayIndexes = weekend_days.map(day => dayMap[day.toUpperCase()]).filter(d => d !== undefined);

        if (weekendDayIndexes.length > 0) {
          const updateQuery = `
            UPDATE academic_calendar
            SET day_type = 'HOLIDAY', holiday_name = 'Weekend'
            WHERE academic_year = ? 
              AND semester = ?
              AND date BETWEEN ? AND ?
              AND DAYOFWEEK(date) IN (?)
          `;
          // DAYOFWEEK() in MySQL: 1=Sunday, 2=Monday..., so we need to add 1 to our indexes
          const mysqlDayIndexes = weekendDayIndexes.map(d => d + 1);
          await connection.query(updateQuery, [academic_year, semester, start_date, end_date, mysqlDayIndexes]);
        }
      }

      await connection.commit();
      return NextResponse.json({ message: 'Calendar generated successfully' });

    } catch (error) {
      await connection.rollback();
      console.error('API_GENERATE_CALENDAR_ERROR:', error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('API_GENERATE_CALENDAR_ERROR:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

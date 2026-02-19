import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(request) {
  try {
    const {
      academic_year,
      semester,
      start_date,
      end_date,
      day_type,
      holiday_name
    } = await request.json();

    // 1. Validation
    if (!academic_year || !semester || !start_date || !end_date || !day_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const validDayTypes = ['WORKING', 'HOLIDAY', 'EXAM', 'INTERNAL', 'EVENT'];
    if (!validDayTypes.includes(day_type)) {
      return NextResponse.json({ error: 'Invalid day_type' }, { status: 400 });
    }

    if (day_type === 'HOLIDAY' && !holiday_name) {
      return NextResponse.json({ error: 'Holiday name is required for day_type HOLIDAY' }, { status: 400 });
    }
    
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    if (startDate > endDate) {
      return NextResponse.json({ error: 'Start date cannot be after end date.' }, { status: 400 });
    }

    const db = await getDb();
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Check if the range is within the semester's defined calendar range
      const [semesterRange] = await connection.query(
        'SELECT MIN(date) as min_date, MAX(date) as max_date FROM academic_calendar WHERE academic_year = ? AND semester = ?',
        [academic_year, semester]
      );
      
      if (semesterRange.length === 0 || !semesterRange[0].min_date) {
        return NextResponse.json({ error: 'Calendar not generated for this semester. Please generate it first.' }, { status: 404 });
      }

      const minDate = new Date(semesterRange[0].min_date);
      const maxDate = new Date(semesterRange[0].max_date);

      if (startDate < minDate || endDate > maxDate) {
        return NextResponse.json({ error: 'Bulk update range cannot be outside the generated semester range.' }, { status: 400 });
      }

      // 2. Build and Execute Update Query
      let updateQuery = `
        UPDATE academic_calendar
        SET 
          day_type = ?,
          holiday_name = ?
        WHERE 
          date BETWEEN ? AND ?
          AND academic_year = ?
          AND semester = ?
      `;
      
      const finalHolidayName = day_type === 'HOLIDAY' ? holiday_name : null;
      let queryParams = [day_type, finalHolidayName, start_date, end_date, academic_year, semester];

      // Smart Update: If setting days to WORKING, do NOT overwrite that semester's defined weekends.
      if (day_type === 'WORKING') {
        const [semesters] = await connection.query(
          'SELECT weekend_pattern FROM semesters WHERE academic_year = ? AND semester = ?',
          [academic_year, semester]
        );

        if (semesters.length > 0 && semesters[0].weekend_pattern) {
          let weekendPattern = [];
            if (typeof semesters[0].weekend_pattern === 'string') {
                weekendPattern = JSON.parse(semesters[0].weekend_pattern || '[]');
            } else if (Array.isArray(semesters[0].weekend_pattern)) {
                weekendPattern = semesters[0].weekend_pattern;
            }

          if (weekendPattern.length > 0) {
            const dayMap = { 'SUNDAY': 1, 'MONDAY': 2, 'TUESDAY': 3, 'WEDNESDAY': 4, 'THURSDAY': 5, 'FRIDAY': 6, 'SATURDAY': 7 };
            const weekendDayIndexes = weekendPattern.map(day => dayMap[day.toUpperCase()]).filter(d => d);
            
            if (weekendDayIndexes.length > 0) {
              updateQuery += ` AND DAYOFWEEK(date) NOT IN (?)`;
              queryParams.push(weekendDayIndexes);
            }
          }
        }
      }

      await connection.query(updateQuery, queryParams);
      
      await connection.commit();
      
      return NextResponse.json({ message: 'Bulk update successful' });

    } catch (error) {
      await connection.rollback();
      console.error('API_BULK_UPDATE_CALENDAR_ERROR:', error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('API_BULK_UPDATE_CALENDAR_ERROR:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

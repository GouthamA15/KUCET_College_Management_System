import logger from '@/lib/logger';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { semesters, academicCalendar } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

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
    // First, ensure the date falls within the configured academic term window.
    const semesterRow = await db.query.semesters.findFirst({
      where: and(
        eq(semesters.academic_year, academic_year),
        eq(semesters.semester, parseInt(semester))
      ),
      columns: {
        start_date: true,
        end_date: true
      }
    });

    if (!semesterRow) {
      return NextResponse.json(
        { data: { day_type: 'HOLIDAY', holiday_name: 'Academic term not configured for this year/semester' } },
        { status: 200 }
      );
    }

    const { start_date, end_date } = semesterRow;
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
    const calendarEntry = await db.query.academicCalendar.findFirst({
        where: and(
            eq(academicCalendar.date, dateStr),
            eq(academicCalendar.academic_year, academic_year),
            eq(academicCalendar.semester, parseInt(semester))
        ),
        columns: {
            day_type: true,
            holiday_name: true
        }
    });

    if (!calendarEntry) {
      // No explicit entry => treat as a normal WORKING day.
      return NextResponse.json({ data: { day_type: 'WORKING', holiday_name: null } });
    }

    return NextResponse.json({ data: calendarEntry });
  } catch (error) {
    logger.error('API_GET_DAY_INFO_ERROR:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

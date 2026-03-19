import { db } from '@/db';
import { academicCalendar, semesters } from '@/db/schema';
import { eq, and, sql, between } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function POST(request) {
  try {
    const user = await getAuthUser('clerk');
    if (!user) return apiError('Unauthorized', 401);
    
    const body = await request.json();
    const { academic_year, semester, start_date, end_date, weekend_days } = body;

    if (!academic_year || !semester || !start_date || !end_date || !Array.isArray(weekend_days)) {
      return apiError('Missing or invalid required fields', 400);
    }

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    if (startDate > endDate) return apiError('Start date cannot be after end date.', 400);

    const semNum = parseInt(semester);

    await db.transaction(async (tx) => {
      // 0. Upsert into the semesters table
      await tx.insert(semesters).values({
        academic_year,
        semester: semNum,
        start_date,
        end_date,
        weekend_pattern: weekend_days,
        created_at: new Date(),
        updated_at: new Date()
      })
      .onDuplicateKeyUpdate({
        set: {
          start_date: sql`VALUES(start_date)`,
          end_date: sql`VALUES(end_date)`,
          weekend_pattern: sql`VALUES(weekend_pattern)`,
          updated_at: sql`NOW()`
        }
      });

      // 1. Generate all days as WORKING days
      const dates = [];
      let currentDate = new Date(startDate.toISOString().slice(0,10));
      while (currentDate <= endDate) {
        dates.push(currentDate.toISOString().slice(0, 10));
        currentDate.setDate(currentDate.getDate() + 1);
      }

      if (dates.length > 0) {
        const values = dates.map(date => ({
          date,
          academic_year,
          semester: semNum,
          day_type: 'WORKING'
        }));
        // Use insertIgnore or manual batch insert since Drizzle doesn't have insertIgnore helper directly
        await tx.insert(academicCalendar).values(values).onDuplicateKeyUpdate({ set: { id: sql`id` } });
      }
      
      // 2. Update weekend days to HOLIDAY
      if (weekend_days.length > 0) {
        const dayMap = { 'SUNDAY': 1, 'MONDAY': 2, 'TUESDAY': 3, 'WEDNESDAY': 4, 'THURSDAY': 5, 'FRIDAY': 6, 'SATURDAY': 7 };
        const mysqlDayIndexes = weekend_days.map(day => dayMap[day.toUpperCase()]).filter(d => d);

        if (mysqlDayIndexes.length > 0) {
          await tx.update(academicCalendar)
            .set({ day_type: 'HOLIDAY', holiday_name: 'Weekend' })
            .where(and(
              eq(academicCalendar.academic_year, academic_year),
              eq(academicCalendar.semester, semNum),
              between(academicCalendar.date, start_date, end_date),
              sql`DAYOFWEEK(${academicCalendar.date}) IN (${sql.join(mysqlDayIndexes, sql`, `)})`
            ));
        }
      }
    });

    return apiResponse({ message: 'Calendar generated successfully' });

  } catch (error) {
    console.error('API_GENERATE_CALENDAR_ERROR:', error);
    return apiError('Internal Server Error', 500);
  }
}

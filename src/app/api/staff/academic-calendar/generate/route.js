import logger from '@/lib/logger';
import { db } from '@/db';
import { academicCalendar, semesters } from '@/db/schema';
import { eq, and, sql, between, ne } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function POST(request) {
  try {
    const user = await getAuthUser('staff');
    if (!user) return apiError('Unauthorized', 401);
    
    const body = await request.json();
    const { academic_year, semester, start_date, end_date, weekend_days } = body;

    if (!academic_year || !semester || !start_date || !end_date || !Array.isArray(weekend_days)) {
      return apiError('Missing or invalid required fields', 400);
    }

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    const semNum = parseInt(semester);

    // Validation: Start Date < End Date
    if (startDate >= endDate) return apiError('Start date must be before end date.', 400);

    // Validation: Duration constraints
    const durationDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (durationDays < 120) return apiError(`Semester duration is ${durationDays} days. Minimum allowed is 120 days.`, 400);
    if (durationDays > 220) return apiError(`Semester duration is ${durationDays} days. Maximum allowed is 220 days.`, 400);

    // Validation: No overlapping semester exists for the same Academic Year
    const existingSemesters = await db.select().from(semesters).where(
      and(
        eq(semesters.academic_year, academic_year),
        ne(semesters.semester, semNum)
      )
    );

    for (const sem of existingSemesters) {
      const existingStart = new Date(sem.start_date);
      const existingEnd = new Date(sem.end_date);
      
      // Overlap condition: startA <= endB AND endA >= startB
      if (startDate <= existingEnd && endDate >= existingStart) {
        return apiError(`Overlapping dates with Semester ${sem.semester} of the same academic year.`, 400);
      }
    }

    await db.transaction(async (tx) => {
      // STEP 2: Delete existing row in semesters matching Academic Year and Semester
      await tx.delete(semesters)
        .where(and(
          eq(semesters.academic_year, academic_year),
          eq(semesters.semester, semNum)
        ));

      // STEP 3: Insert the updated semester definition into semesters
      await tx.insert(semesters).values({
        academic_year,
        semester: semNum,
        start_date,
        end_date,
        weekend_pattern: weekend_days,
        created_at: new Date(),
        updated_at: new Date()
      });

      // STEP 4: Delete every generated record from academic_calendar
      await tx.delete(academicCalendar)
        .where(and(
          eq(academicCalendar.academic_year, academic_year),
          eq(academicCalendar.semester, semNum)
        ));

      // STEP 5: Generate the calendar
      const dates = [];
      let currentDate = new Date(startDate.toISOString().slice(0, 10));
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
        await tx.insert(academicCalendar).values(values);
      }
      
      // Update weekend days to HOLIDAY
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
    logger.error('API_GENERATE_CALENDAR_ERROR:', error);
    return apiError('Internal Server Error', 500);
  }
}


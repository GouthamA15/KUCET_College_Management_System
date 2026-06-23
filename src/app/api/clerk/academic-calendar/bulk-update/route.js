import logger from '@/lib/logger';
import { db } from '@/db';
import { academicCalendar, semesters } from '@/db/schema';
import { eq, and, between, sql, _notInArray, min, max } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function POST(request) {
  try {
    const user = await getAuthUser('clerk');
    if (!user) return apiError('Unauthorized', 401);
    
    const body = await request.json();
    const { academic_year, semester, start_date, end_date, day_type, holiday_name } = body;

    if (!academic_year || !semester || !start_date || !end_date || !day_type) {
      return apiError('Missing required fields', 400);
    }

    const validDayTypes = ['WORKING', 'HOLIDAY', 'EXAM', 'INTERNAL', 'EVENT'];
    if (!validDayTypes.includes(day_type)) return apiError('Invalid day_type', 400);
    if (day_type === 'HOLIDAY' && !holiday_name) return apiError('Holiday name is required for day_type HOLIDAY', 400);
    
    const startDateObj = new Date(start_date);
    const endDateObj = new Date(end_date);
    if (startDateObj > endDateObj) return apiError('Start date cannot be after end date.', 400);

    const semNum = parseInt(semester);

    const _result = await db.transaction(async (tx) => {
      const semesterRange = await tx.select({
        min_date: min(academicCalendar.date),
        max_date: max(academicCalendar.date)
      })
      .from(academicCalendar)
      .where(and(
        eq(academicCalendar.academic_year, academic_year),
        eq(academicCalendar.semester, semNum)
      ));
      
      if (semesterRange.length === 0 || !semesterRange[0].min_date) {
        throw new Error('CALENDAR_NOT_FOUND');
      }

      const minDate = new Date(semesterRange[0].min_date);
      const maxDate = new Date(semesterRange[0].max_date);
      if (startDateObj < minDate || endDateObj > maxDate) {
        throw new Error('OUT_OF_RANGE');
      }

      const finalHolidayName = day_type === 'HOLIDAY' ? holiday_name : null;
      
      let conditions = [
        between(academicCalendar.date, start_date, end_date),
        eq(academicCalendar.academic_year, academic_year),
        eq(academicCalendar.semester, semNum)
      ];

      // Smart Update: If setting days to WORKING, do NOT overwrite that semester's defined weekends.
      if (day_type === 'WORKING') {
        const semData = await tx.query.semesters.findFirst({
          where: and(eq(semesters.academic_year, academic_year), eq(semesters.semester, semNum))
        });

        if (semData && semData.weekend_pattern) {
          const weekendPattern = Array.isArray(semData.weekend_pattern) 
            ? semData.weekend_pattern 
            : JSON.parse(semData.weekend_pattern || '[]');

          if (weekendPattern.length > 0) {
            const dayMap = { 'SUNDAY': 1, 'MONDAY': 2, 'TUESDAY': 3, 'WEDNESDAY': 4, 'THURSDAY': 5, 'FRIDAY': 6, 'SATURDAY': 7 };
            const weekendDayIndexes = weekendPattern.map(day => dayMap[day.toUpperCase()]).filter(d => d);
            if (weekendDayIndexes.length > 0) {
              conditions.push(sql`DAYOFWEEK(${academicCalendar.date}) NOT IN (${sql.join(weekendDayIndexes, sql`, `)})`);
            }
          }
        }
      }

      await tx.update(academicCalendar)
        .set({ day_type, holiday_name: finalHolidayName })
        .where(and(...conditions));
      
      return { success: true };
    });

    return apiResponse({ message: 'Bulk update successful' });

  } catch (error) {
    if (error.message === 'CALENDAR_NOT_FOUND') return apiError('Calendar not generated for this semester.', 404);
    if (error.message === 'OUT_OF_RANGE') return apiError('Bulk update range cannot be outside the generated semester range.', 400);
    logger.error('API_BULK_UPDATE_CALENDAR_ERROR:', error);
    return apiError('Internal Server Error', 500);
  }
}

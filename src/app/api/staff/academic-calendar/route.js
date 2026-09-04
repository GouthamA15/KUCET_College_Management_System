import logger from '@/lib/logger';
import { db } from '@/db';
import { academicCalendar } from '@/db/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { getNow } from '@/lib/clock';

export async function GET(request) {
  try {
    const user = await getAuthUser('staff');
    if (!user) return apiError('Unauthorized', 401);

    const { searchParams } = new URL(request.url);
    const academic_year = searchParams.get('academic_year');
    const semester = searchParams.get('semester');
    const month = parseInt(searchParams.get('month'), 10);
    const year = parseInt(searchParams.get('year'), 10);

    if (!academic_year || !semester || !month || !year) {
      return apiError('Missing required parameters', 400);
    }

    const lastDay = new Date(year, month, 0).getDate();
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const rows = await db.select()
      .from(academicCalendar)
      .where(and(
        eq(academicCalendar.academic_year, academic_year),
        eq(academicCalendar.semester, parseInt(semester)),
        gte(academicCalendar.date, startDate),
        lte(academicCalendar.date, endDate)
      ));

    return apiResponse({ data: rows });
  } catch (error) {
    logger.error('API_GET_ACADEMIC_CALENDAR_ERROR:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function POST(request) {
    try {
      const user = await getAuthUser('hod');
      if (!user) return apiError('Unauthorized', 401);

      const body = await request.json();
      let { date, academic_year, semester, day_type, holiday_name } = body;

      if (!date || !academic_year || !semester || !day_type) {
        return apiError('Missing required fields', 400);
      }
      
      const validDayTypes = ['WORKING', 'HOLIDAY', 'EXAM', 'INTERNAL', 'EVENT'];
      if (!validDayTypes.includes(day_type)) return apiError('Invalid day_type specified', 400);
      if (day_type === 'HOLIDAY' && !holiday_name) return apiError('Holiday name is required for holidays.', 400);
      if (day_type !== 'HOLIDAY') holiday_name = null;

      let dateString = String(date);
      if (dateString.includes('T')) dateString = dateString.split('T')[0];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return apiError('Invalid date format. Use YYYY-MM-DD.', 400);

      const now = await getNow();

      await db.insert(academicCalendar).values({
        date: dateString,
        academic_year,
        semester: parseInt(semester),
        day_type,
        holiday_name,
        created_at: now,
        updated_at: now
      })
      .onDuplicateKeyUpdate({
        set: {
          day_type: sql`VALUES(day_type)`,
          holiday_name: sql`VALUES(holiday_name)`,
          updated_at: sql`VALUES(updated_at)`
        }
      });

      return apiResponse({ message: 'Calendar updated successfully' });
    } catch (error) {
      logger.error('API_POST_ACADEMIC_CALENDAR_ERROR:', error);
      return apiError('Internal Server Error', 500);
    }
  }

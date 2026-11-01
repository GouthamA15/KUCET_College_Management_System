import logger from '@/lib/logger';
import { db } from '@/db';
import { academicCalendar, semesters } from '@/db/schema';
import { eq, and, ne, inArray, or, lt, gt } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { clearCalendarSessionCache } from '@/lib/academic-utils';

export async function POST(request) {
  try {
    const user = await getAuthUser('hod');
    if (!user) return apiError('Unauthorized', 401);
    
    const body = await request.json();
    const { academic_year, semester, start_date, end_date, weekend_days, confirm_date_change } = body;

    if (!academic_year || !semester || !start_date || !end_date || !Array.isArray(weekend_days)) {
      return apiError('Missing or invalid required fields', 400);
    }
    
    if (!academic_year.match(/^\d{4}-\d{2}$/)) {
      return apiError('Invalid academic_year format. Expected YYYY-YY', 400);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date) || !/^\d{4}-\d{2}-\d{2}$/.test(end_date)) {
      return apiError('Invalid date format. Expected YYYY-MM-DD', 400);
    }

    const startDate = new Date(`${start_date}T00:00:00Z`);
    const endDate = new Date(`${end_date}T00:00:00Z`);
    const semNum = parseInt(semester, 10);

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
      const existingStart = new Date(`${sem.start_date}T00:00:00Z`);
      const existingEnd = new Date(`${sem.end_date}T00:00:00Z`);
      
      // Overlap condition: startA <= endB AND endA >= startB
      if (startDate <= existingEnd && endDate >= existingStart) {
        return apiError(`Overlapping dates with Semester ${sem.semester} of the same academic year.`, 400);
      }
    }

    // Prepare UTC-safe array of target dates
    const dates = [];
    const [sY, sM, sD] = start_date.split('-').map(Number);
    const [eY, eM, eD] = end_date.split('-').map(Number);
    let currentUtc = new Date(Date.UTC(sY, sM - 1, sD));
    const endUtc = new Date(Date.UTC(eY, eM - 1, eD));

    while (currentUtc <= endUtc) {
      const y = currentUtc.getUTCFullYear();
      const m = String(currentUtc.getUTCMonth() + 1).padStart(2, '0');
      const d = String(currentUtc.getUTCDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
      currentUtc.setUTCDate(currentUtc.getUTCDate() + 1);
    }

    // Map weekend days to UTC day indexes (0=Sun, 1=Mon, ..., 6=Sat)
    const dayMap = {
      'SUNDAY': 0,
      'MONDAY': 1,
      'TUESDAY': 2,
      'WEDNESDAY': 3,
      'THURSDAY': 4,
      'FRIDAY': 5,
      'SATURDAY': 6
    };
    const weekendUtcDays = new Set(
      weekend_days
        .map(d => typeof d === 'string' ? dayMap[d.toUpperCase()] : undefined)
        .filter(x => x !== undefined)
    );

    let resultSummary = null;

    await db.transaction(async (tx) => {
      // 1. Fetch existing calendar records for this semester
      const existingRecords = await tx.select()
        .from(academicCalendar)
        .where(and(
          eq(academicCalendar.academic_year, academic_year),
          eq(academicCalendar.semester, semNum)
        ));

      // 2. Detect out-of-range records if date range has shrunk
      const outOfRangeRecords = existingRecords.filter(r => {
        const dStr = typeof r.date === 'string' && r.date.includes('T') ? r.date.split('T')[0] : String(r.date);
        return dStr < start_date || dStr > end_date;
      });

      if (outOfRangeRecords.length > 0 && !confirm_date_change) {
        const err = new Error('CONFIRMATION_REQUIRED');
        err.affectedCount = outOfRangeRecords.length;
        err.affectedDates = outOfRangeRecords.map(r => typeof r.date === 'string' && r.date.includes('T') ? r.date.split('T')[0] : String(r.date)).slice(0, 15);
        throw err;
      }

      // If confirmed, prune out-of-range records
      if (outOfRangeRecords.length > 0 && confirm_date_change) {
        await tx.delete(academicCalendar)
          .where(and(
            eq(academicCalendar.academic_year, academic_year),
            eq(academicCalendar.semester, semNum),
            or(
              lt(academicCalendar.date, start_date),
              gt(academicCalendar.date, end_date)
            )
          ));
      }

      // 3. Upsert / update semester boundaries in `semesters` table
      await tx.delete(semesters)
        .where(and(
          eq(semesters.academic_year, academic_year),
          eq(semesters.semester, semNum)
        ));

      await tx.insert(semesters).values({
        academic_year,
        semester: semNum,
        start_date,
        end_date,
        weekend_pattern: weekend_days,
        created_at: new Date(),
        updated_at: new Date()
      });

      // 4. Map existing in-range records by date
      const existingMap = new Map();
      for (const rec of existingRecords) {
        const dStr = typeof rec.date === 'string' && rec.date.includes('T') ? rec.date.split('T')[0] : String(rec.date);
        if (dStr >= start_date && dStr <= end_date) {
          existingMap.set(dStr, rec);
        }
      }

      const recordsToInsert = [];
      const recordsToUpdateWeekend = [];
      const recordsToUpdateWorking = [];
      let preservedHolidaysCount = 0;
      let preservedCustomDaysCount = 0;

      const now = new Date();

      for (const dateStr of dates) {
        const [y, m, d] = dateStr.split('-').map(Number);
        const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
        const isWeekend = weekendUtcDays.has(dayOfWeek);

        if (!existingMap.has(dateStr)) {
          // New / missing date
          recordsToInsert.push({
            date: dateStr,
            academic_year,
            semester: semNum,
            day_type: isWeekend ? 'HOLIDAY' : 'WORKING',
            holiday_name: isWeekend ? 'Weekend' : null,
            created_at: now,
            updated_at: now
          });
        } else {
          // Existing record: PRESERVE custom classifications!
          const existing = existingMap.get(dateStr);

          if (existing.day_type === 'HOLIDAY') {
            if (existing.holiday_name && existing.holiday_name !== 'Weekend') {
              // Declared public holiday or custom holiday (e.g. Gandhi Jayanti, Diwali)
              // DO NOT OVERWRITE, even if it falls on a weekend!
              preservedHolidaysCount++;
            } else if (existing.holiday_name === 'Weekend') {
              if (!isWeekend) {
                // Weekend pattern changed: former weekend is now an ordinary day
                recordsToUpdateWorking.push(dateStr);
              }
            }
          } else if (['EXAM', 'INTERNAL', 'EVENT'].includes(existing.day_type)) {
            // Exam, internal, or event day: DO NOT OVERWRITE!
            preservedCustomDaysCount++;
          } else if (existing.day_type === 'WORKING') {
            if (isWeekend) {
              // Existing working day is now configured as a weekend
              recordsToUpdateWeekend.push(dateStr);
            }
          }
        }
      }

      // Batch insert missing dates
      if (recordsToInsert.length > 0) {
        await tx.insert(academicCalendar).values(recordsToInsert);
      }

      // Update days that newly became weekends
      if (recordsToUpdateWeekend.length > 0) {
        await tx.update(academicCalendar)
          .set({ day_type: 'HOLIDAY', holiday_name: 'Weekend', updated_at: now })
          .where(and(
            eq(academicCalendar.academic_year, academic_year),
            eq(academicCalendar.semester, semNum),
            inArray(academicCalendar.date, recordsToUpdateWeekend)
          ));
      }

      // Update days that are no longer weekends
      if (recordsToUpdateWorking.length > 0) {
        await tx.update(academicCalendar)
          .set({ day_type: 'WORKING', holiday_name: null, updated_at: now })
          .where(and(
            eq(academicCalendar.academic_year, academic_year),
            eq(academicCalendar.semester, semNum),
            inArray(academicCalendar.date, recordsToUpdateWorking)
          ));
      }

      resultSummary = {
        totalDays: dates.length,
        insertedCount: recordsToInsert.length,
        preservedHolidaysCount,
        preservedCustomDaysCount,
        updatedWeekendsCount: recordsToUpdateWeekend.length,
        removedOutOfRangeCount: outOfRangeRecords.length
      };
    });

    clearCalendarSessionCache();

    return apiResponse({
      message: 'Calendar generated successfully',
      data: resultSummary
    });

  } catch (error) {
    if (error.message === 'CONFIRMATION_REQUIRED') {
      return apiError(
        'Existing calendar entries found outside the new date range. Explicit confirmation is required to remove out-of-range dates.',
        409,
        {
          requires_confirmation: true,
          affectedCount: error.affectedCount,
          affectedDates: error.affectedDates
        }
      );
    }
    logger.error('API_GENERATE_CALENDAR_ERROR:', error);
    return apiError('Internal Server Error', 500);
  }
}


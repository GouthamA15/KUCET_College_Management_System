import logger from '@/lib/logger';
import { db } from '@/db';
import { academicCalendar, semesters, auditLogs } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { HolidayCandidateService } from '@/lib/holidays/HolidayCandidateService';
import { clearCalendarSessionCache } from '@/lib/academic-utils';
import { safeJsonParse } from '@/lib/json-utils';

export async function GET(request) {
  try {
    const user = await getAuthUser('hod');
    if (!user) return apiError('Unauthorized', 401);

    const { searchParams } = new URL(request.url);
    const academic_year = searchParams.get('academic_year');
    const semester = searchParams.get('semester');

    if (!academic_year || !semester) {
      return apiError('Missing required parameters: academic_year, semester', 400);
    }

    if (!academic_year.match(/^\d{4}-\d{2}$/)) {
      return apiError('Invalid academic_year format. Expected YYYY-YY', 400);
    }

    const semNum = parseInt(semester, 10);
    if (![1, 2].includes(semNum)) {
      return apiError('Invalid semester. Expected 1 or 2', 400);
    }

    // 1. Fetch semester definition from `semesters` table
    const semesterRow = await db.query.semesters.findFirst({
      where: and(
        eq(semesters.academic_year, academic_year),
        eq(semesters.semester, semNum)
      )
    });

    if (!semesterRow) {
      return apiError('Semester setup not found. Please complete Semester Setup before discovering holidays.', 404);
    }

    const startDateStr = typeof semesterRow.start_date === 'string' && semesterRow.start_date.includes('T')
      ? semesterRow.start_date.split('T')[0]
      : String(semesterRow.start_date);

    const endDateStr = typeof semesterRow.end_date === 'string' && semesterRow.end_date.includes('T')
      ? semesterRow.end_date.split('T')[0]
      : String(semesterRow.end_date);

    const weekendDays = Array.isArray(semesterRow.weekend_pattern)
      ? semesterRow.weekend_pattern
      : safeJsonParse(semesterRow.weekend_pattern, ['SUNDAY']);

    // 2. Fetch all existing calendar entries for this semester
    const existingEntries = await db.select({
      id: academicCalendar.id,
      date: academicCalendar.date,
      day_type: academicCalendar.day_type,
      holiday_name: academicCalendar.holiday_name
    })
    .from(academicCalendar)
    .where(and(
      eq(academicCalendar.academic_year, academic_year),
      eq(academicCalendar.semester, semNum)
    ));

    // 3. Generate candidate suggestions (Read-only)
    const candidates = HolidayCandidateService.generateCandidates({
      startDate: startDateStr,
      endDate: endDateStr,
      weekendDays,
      existingCalendarEntries: existingEntries
    });

    return apiResponse({
      data: {
        academic_year,
        semester: semNum,
        start_date: startDateStr,
        end_date: endDateStr,
        weekend_pattern: weekendDays,
        existingCount: existingEntries.length,
        candidateCount: candidates.length,
        candidates
      }
    });

  } catch (error) {
    logger.error('API_GET_HOLIDAY_CANDIDATES_ERROR:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function POST(request) {
  try {
    const user = await getAuthUser('hod');
    if (!user) return apiError('Unauthorized', 401);

    const body = await request.json();
    const { academic_year, semester, holidays } = body;

    if (!academic_year || !semester || !Array.isArray(holidays) || holidays.length === 0) {
      return apiError('Missing or invalid required fields: academic_year, semester, holidays', 400);
    }

    if (!academic_year.match(/^\d{4}-\d{2}$/)) {
      return apiError('Invalid academic_year format. Expected YYYY-YY', 400);
    }

    const semNum = parseInt(semester, 10);
    if (![1, 2].includes(semNum)) {
      return apiError('Invalid semester. Expected 1 or 2', 400);
    }

    // 1. Fetch semester boundaries
    const semesterRow = await db.query.semesters.findFirst({
      where: and(
        eq(semesters.academic_year, academic_year),
        eq(semesters.semester, semNum)
      )
    });

    if (!semesterRow) {
      return apiError('Semester not configured.', 404);
    }

    const startDateStr = typeof semesterRow.start_date === 'string' && semesterRow.start_date.includes('T')
      ? semesterRow.start_date.split('T')[0]
      : String(semesterRow.start_date);

    const endDateStr = typeof semesterRow.end_date === 'string' && semesterRow.end_date.includes('T')
      ? semesterRow.end_date.split('T')[0]
      : String(semesterRow.end_date);

    // 2. Validate and sanitize each holiday
    const sanitizedHolidays = [];
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    for (const h of holidays) {
      if (!h.date || !dateRegex.test(h.date)) {
        return apiError(`Invalid date format for holiday: ${h.date}. Expected YYYY-MM-DD`, 400);
      }
      if (h.date < startDateStr || h.date > endDateStr) {
        return apiError(`Holiday date ${h.date} is outside the semester window (${startDateStr} to ${endDateStr}).`, 400);
      }
      const rawName = typeof h.name === 'string' ? h.name.trim() : '';
      if (!rawName) {
        return apiError(`Holiday name is required for date ${h.date}`, 400);
      }
      // Sanitize: strip any tags, max 255 chars
      const sanitizedName = rawName.replace(/<[^>]*>?/gm, '').slice(0, 255);

      sanitizedHolidays.push({
        date: h.date,
        name: sanitizedName,
        replace_conflicts: !!h.replace_conflicts
      });
    }

    const approvedDates = [];
    const skippedConflicts = [];
    const now = new Date();

    await db.transaction(async (tx) => {
      // Fetch existing rows for these target dates to recheck current database state
      const targetDates = sanitizedHolidays.map(h => h.date);
      const existingRows = await tx.select()
        .from(academicCalendar)
        .where(and(
          eq(academicCalendar.academic_year, academic_year),
          eq(academicCalendar.semester, semNum),
          inArray(academicCalendar.date, targetDates)
        ));

      const existingMap = new Map();
      for (const row of existingRows) {
        const dStr = typeof row.date === 'string' && row.date.includes('T') ? row.date.split('T')[0] : String(row.date);
        existingMap.set(dStr, row);
      }

      for (const item of sanitizedHolidays) {
        const existing = existingMap.get(item.date);

        // Protect existing EXAM, INTERNAL, and EVENT records unless explicitly authorized
        if (existing && ['EXAM', 'INTERNAL', 'EVENT'].includes(existing.day_type) && !item.replace_conflicts) {
          skippedConflicts.push({
            date: item.date,
            name: item.name,
            reason: `Conflicted with existing ${existing.day_type} designation`
          });
          continue;
        }

        if (existing) {
          // Update existing row
          await tx.update(academicCalendar)
            .set({
              day_type: 'HOLIDAY',
              holiday_name: item.name,
              updated_at: now
            })
            .where(and(
              eq(academicCalendar.academic_year, academic_year),
              eq(academicCalendar.semester, semNum),
              eq(academicCalendar.date, item.date)
            ));
        } else {
          // Insert new row if missing
          await tx.insert(academicCalendar).values({
            date: item.date,
            academic_year,
            semester: semNum,
            day_type: 'HOLIDAY',
            holiday_name: item.name,
            created_at: now,
            updated_at: now
          });
        }

        approvedDates.push({ date: item.date, name: item.name });
      }

      // Record audit log
      if (auditLogs && tx.insert) {
        try {
          await tx.insert(auditLogs).values({
            user_id: user.staffId || user.id || 1,
            user_type: user.role === 'admin' ? 'admin' : 'staff',
            action: 'APPROVE_HOLIDAY_CANDIDATES',
            target_id: `${academic_year}_sem${semNum}`,
            target_type: 'academic_calendar',
            payload_after: {
              approved_count: approvedDates.length,
              approved_dates: approvedDates,
              skipped_conflicts: skippedConflicts
            },
            created_at: now
          });
        } catch (_auditErr) {
          // If audit log table insertion fails in mock/test, log error but do not roll back calendar updates
          logger.warn('Failed to insert audit log for holiday approval');
        }
      }
    });

    clearCalendarSessionCache();

    return apiResponse({
      message: `Successfully approved and saved ${approvedDates.length} holidays.`,
      data: {
        approvedCount: approvedDates.length,
        skippedCount: skippedConflicts.length,
        approvedDates,
        skippedConflicts
      }
    });

  } catch (error) {
    logger.error('API_POST_APPROVE_HOLIDAYS_ERROR:', error);
    return apiError('Internal Server Error', 500);
  }
}

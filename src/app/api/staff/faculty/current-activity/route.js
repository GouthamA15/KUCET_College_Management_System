import logger from '@/lib/logger';
import { db } from '@/db';
import { branchTimetable, syllabusSubjects } from '@/db/schema';
import { eq, and, sql, like } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { Clock } from '@/lib/clock';
import { getCollegeAcademicYear } from '@/lib/academic-utils';

export async function GET(req) {
  try {
    const user = await getAuthUser('faculty');
    if (!user || (user.role !== 'faculty' && user.role !== 'admin')) return apiError('Unauthorized', 401);

    const now = Clock.now(req);
    const parts = Clock.getISTParts(now);
    const day = parts.dayName;
    const period = Clock.currentPeriod(now);

    if (!period || day === 'SUN') {
      return apiResponse({ active: false, message: 'Outside college hours or Weekend' });
    }

    const facultyId = user.staffId || user.id;
    const systemYear = await getCollegeAcademicYear();
    const yearPattern = `%${systemYear.substring(0, 4)}%`;

    const rows = await db.select({
      branch: branchTimetable.branch,
      semester: branchTimetable.semester,
      room_no: branchTimetable.room_no,
      subject_name: sql`COALESCE(${syllabusSubjects.subject_name}, ${branchTimetable.subject_code})`,
      subject_code: branchTimetable.subject_code
    })
    .from(branchTimetable)
    .leftJoin(syllabusSubjects, eq(branchTimetable.subject_code, syllabusSubjects.subject_code))
    .where(and(
      eq(branchTimetable.faculty_id, facultyId),
      eq(branchTimetable.day_of_week, day),
      eq(branchTimetable.period_number, period),
      like(branchTimetable.academic_year, yearPattern)
    ))
    .limit(1);

    if (rows.length === 0) {
      return apiResponse({ active: false, message: 'Free period' });
    }

    return apiResponse({ active: true, period, activity: rows[0] });
  } catch (error) {
    logger.error('Current Activity API Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

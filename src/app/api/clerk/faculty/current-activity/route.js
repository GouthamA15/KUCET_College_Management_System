import { db } from '@/db';
import { branchTimetable, syllabusSubjects, semesters } from '@/db/schema';
import { eq, and, desc, sql, like, or } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { getNow } from '@/lib/clock';

export async function GET(req) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty') return apiError('Unauthorized', 401);

    const now = await getNow();
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const day = days[now.getDay()]; 
    const time = now.getHours() * 100 + now.getMinutes(); 

    let period = null;
    if (time >= 930 && time < 1020) period = 1;
    else if (time >= 1020 && time < 1110) period = 2;
    else if (time >= 1120 && time < 1210) period = 3;
    else if (time >= 1210 && time < 1300) period = 4;
    else if (time >= 1400 && time < 1450) period = 5;
    else if (time >= 1450 && time < 1540) period = 6;
    else if (time >= 1540 && time < 1630) period = 7;

    if (!period || day === 'SUN') {
      return apiResponse({ active: false, message: 'Outside college hours or Weekend' });
    }

    const clerkId = user.id || user.clerkId;
    const semRows = await db.select({ academic_year: semesters.academic_year })
      .from(semesters)
      .orderBy(desc(semesters.id))
      .limit(1);
    const systemYear = semRows[0]?.academic_year || '2025-26';
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
      eq(branchTimetable.faculty_id, clerkId),
      eq(branchTimetable.day_of_week, day),
      eq(branchTimetable.period_number, period),
      or(
        like(branchTimetable.academic_year, yearPattern),
        eq(branchTimetable.academic_year, '2025-26')
      )
    ))
    .limit(1);

    if (rows.length === 0) {
      return apiResponse({ active: false, message: 'Free period' });
    }

    return apiResponse({ active: true, period, activity: rows[0] });
  } catch (error) {
    console.error('Current Activity API Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

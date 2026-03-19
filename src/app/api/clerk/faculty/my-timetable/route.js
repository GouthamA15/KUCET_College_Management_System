import { db } from '@/db';
import { branchTimetable, syllabusSubjects, semesters } from '@/db/schema';
import { eq, and, desc, sql, like, or } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty') return apiError('Unauthorized', 401);

    const clerkId = user.id || user.clerkId;
    if (!clerkId) return apiError('Faculty ID missing.', 400);

    const semRows = await db.select({ academic_year: semesters.academic_year })
      .from(semesters)
      .orderBy(desc(semesters.id))
      .limit(1);
    const systemYear = semRows[0]?.academic_year || '2025-26';
    const yearPattern = `%${systemYear.substring(0, 4)}%`;

    const mySchedule = await db.select({
      day_of_week: branchTimetable.day_of_week,
      period_number: branchTimetable.period_number,
      branch: branchTimetable.branch,
      semester: branchTimetable.semester,
      room_no: branchTimetable.room_no,
      display_name: sql`COALESCE(${syllabusSubjects.subject_name}, ${branchTimetable.subject_code})`,
      subject_code: branchTimetable.subject_code
    })
    .from(branchTimetable)
    .leftJoin(syllabusSubjects, eq(branchTimetable.subject_code, syllabusSubjects.subject_code))
    .where(and(
      eq(branchTimetable.faculty_id, clerkId),
      or(
        like(branchTimetable.academic_year, yearPattern),
        eq(branchTimetable.academic_year, '2025-26')
      )
    ))
    .orderBy(
      sql`FIELD(${branchTimetable.day_of_week}, 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT')`,
      branchTimetable.period_number
    );

    return apiResponse({ data: mySchedule });
  } catch (error) {
    console.error('Faculty My-Timetable API Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

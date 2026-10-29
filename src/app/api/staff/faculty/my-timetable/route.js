import logger from '@/lib/logger';
import { db } from '@/db';
import { branchTimetable, timetableInstances, syllabusSubjects } from '@/db/schema';
import { eq, and, sql, like } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { getCollegeAcademicYear } from '@/lib/academic-utils';

export async function GET(_req) {
  try {
    const user = await getAuthUser('faculty');
    if (!user || (user.role !== 'faculty' && user.role !== 'admin')) return apiError('Unauthorized', 401);

    const facultyId = user.staffId || user.id;
    if (!facultyId) return apiError('Faculty ID missing.', 400);

    const systemYear = await getCollegeAcademicYear();
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
    .innerJoin(timetableInstances, eq(branchTimetable.timetable_instance_id, timetableInstances.id))
    .leftJoin(syllabusSubjects, eq(branchTimetable.subject_code, syllabusSubjects.subject_code))
    .where(and(
      eq(branchTimetable.faculty_id, facultyId),
      eq(timetableInstances.status, 'PUBLISHED'),
      like(branchTimetable.academic_year, yearPattern)
    ))
    .orderBy(
      sql`FIELD(${branchTimetable.day_of_week}, 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT')`,
      branchTimetable.period_number
    );

    return apiResponse({ data: mySchedule });
  } catch (error) {
    logger.error('Faculty My-Timetable API Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

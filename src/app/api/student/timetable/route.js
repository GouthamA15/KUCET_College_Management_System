import { db } from '@/db';
import { 
  collegeInfo as collegeInfoTable, 
  semesters, 
  branchTimetable, 
  syllabusSubjects, 
  clerks 
} from '@/db/schema';
import { eq, and, desc, like, or, sql } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { getCurrentSemester, getBranchFromRoll } from '@/lib/rollNumber';

export async function GET(req) {
  try {
    const user = await getAuthUser('student');
    if (!user) return apiError('Unauthorized', 401);

    const rollNo = user.roll_no || user.rollNo;
    if (!rollNo) return apiError('Roll number missing from session.', 400);

    const collegeRows = await db.select().from(collegeInfoTable).limit(1);
    const collegeInfo = collegeRows[0] || null;

    const semester = getCurrentSemester(rollNo, collegeInfo);
    const branch = getBranchFromRoll(rollNo);

    if (!semester || !branch) return apiError('Resolution failed', 400);

    const semRow = await db.query.semesters.findFirst({
      orderBy: [desc(semesters.id)]
    });
    const systemYear = semRow?.academic_year || '2025-26';

    const timetable = await db.select({
      day_of_week: branchTimetable.day_of_week,
      period_number: branchTimetable.period_number,
      room_no: branchTimetable.room_no,
      display_name: sql`COALESCE(${syllabusSubjects.subject_name}, ${branchTimetable.subject_code})`,
      subject_code: branchTimetable.subject_code,
      faculty_name: clerks.name
    })
    .from(branchTimetable)
    .leftJoin(syllabusSubjects, eq(branchTimetable.subject_code, syllabusSubjects.subject_code))
    .leftJoin(clerks, eq(branchTimetable.faculty_id, clerks.id))
    .where(and(
      eq(branchTimetable.branch, branch),
      eq(branchTimetable.semester, semester),
      or(
        like(branchTimetable.academic_year, `%${systemYear.substring(0, 4)}%`),
        eq(branchTimetable.academic_year, '2025-26')
      )
    ))
    .orderBy(
      sql`FIELD(${branchTimetable.day_of_week}, 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT')`,
      branchTimetable.period_number
    );

    return apiResponse({ data: timetable, meta: { branch, semester, systemYear, rollNo } });
  } catch (error) {
    console.error('Student Timetable API Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

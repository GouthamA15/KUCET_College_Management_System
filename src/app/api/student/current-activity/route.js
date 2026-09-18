import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  semesters, 
  branchTimetable, 
  syllabusSubjects, 
  staffAccounts 
} from '@/db/schema';
import { eq, and, desc, like, or } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { Clock } from '@/lib/clock';
import { getBranchFromRoll } from '@/lib/rollNumber';
import { calculateYearAndSemesterAsync } from '@/lib/academic-utils';

export async function GET(req) {
  try {
    const user = await getAuthUser('student');
    if (!user) return apiError('Unauthorized', 401);

    const rollNo = user.roll_no || user.rollNo;
    if (!rollNo) return apiError('Roll number missing.', 400);

    const now = Clock.now(req);
    const parts = Clock.getISTParts(now);
    const day = parts.dayName;
    const period = Clock.currentPeriod(now);

    if (!period || day === 'SUN') {
      return apiResponse({ active: false, message: 'Outside college hours' });
    }

    // Resolve context
    const academicSession = await calculateYearAndSemesterAsync(rollNo, user.academic_offset_years || 0);
    const { semester, status: sessionStatus } = academicSession;
    const branch = getBranchFromRoll(rollNo);

    if (sessionStatus === 'Semester Not Configured') {
      return apiError('Academic Calendar not configured.', 400);
    }

    if (!semester || !branch) {
      return apiResponse({ active: false, message: 'Context resolution failed' });
    }

    const semRow = await db.query.semesters.findFirst({
      orderBy: [desc(semesters.id)]
    });
    const systemYear = semRow?.academic_year || '2025-26';

    const timetableRows = await db.select({
      room_no: branchTimetable.room_no,
      subject_name: syllabusSubjects.subject_name,
      faculty_name: staffAccounts.name,
      subject_code: branchTimetable.subject_code
    })
    .from(branchTimetable)
    .leftJoin(syllabusSubjects, eq(branchTimetable.subject_code, syllabusSubjects.subject_code))
    .leftJoin(staffAccounts, eq(branchTimetable.faculty_id, staffAccounts.id))
    .where(and(
      eq(branchTimetable.branch, branch),
      eq(branchTimetable.semester, semester),
      eq(branchTimetable.day_of_week, day),
      eq(branchTimetable.period_number, period),
      or(
        like(branchTimetable.academic_year, `%${systemYear.substring(0, 4)}%`),
        eq(branchTimetable.academic_year, '2025-26')
      )
    ))
    .limit(1);

    if (timetableRows.length === 0) {
      return apiResponse({ active: false, message: 'No lecture scheduled' });
    }

    const activity = {
      ...timetableRows[0],
      subject_name: timetableRows[0].subject_name || timetableRows[0].subject_code
    };

    return apiResponse({ 
      active: true, 
      period,
      activity 
    });
  } catch (error) {
    logger.error('Student Current Activity API Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

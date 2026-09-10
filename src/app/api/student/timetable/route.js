import { wrapHandler } from '@/lib/api-utils';
import { getBranchFromRoll } from '@/lib/rollNumber';
import { calculateYearAndSemesterAsync } from '@/lib/academic-utils';
import { FacultyService } from '@/services/FacultyService';
import { db } from '@/db';
import { branchTimetable, timetableInstances, syllabusSubjects, staffAccounts } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export const GET = wrapHandler({
  auth: 'student',
  handler: async (req, { user }) => {
    const rollNo = user.roll_no;
    const academicSession = await calculateYearAndSemesterAsync(rollNo, user.academic_offset_years || 0);
    const { semester, status: sessionStatus } = academicSession;
    const branch = getBranchFromRoll(rollNo);
    const systemYear = await FacultyService.getCurrentAcademicYear();

    if (!semester || !branch) throw new Error('Resolution failed');

    const yearLevel = Math.ceil(semester / 2);

    const timetable = await db.select({
      day_of_week: branchTimetable.day_of_week,
      period_number: branchTimetable.period_number,
      subject_code: branchTimetable.subject_code,
      room_no: branchTimetable.room_no,
      display_name: sql`COALESCE(${syllabusSubjects.subject_name}, ${branchTimetable.subject_code})`,
      faculty_name: staffAccounts.name
    })
    .from(branchTimetable)
    .innerJoin(timetableInstances, eq(branchTimetable.timetable_instance_id, timetableInstances.id))
    .leftJoin(syllabusSubjects, eq(branchTimetable.subject_code, syllabusSubjects.subject_code))
    .leftJoin(staffAccounts, eq(branchTimetable.faculty_id, staffAccounts.id))
    .where(and(
      eq(timetableInstances.branch, branch),
      eq(timetableInstances.semester, semester),
      eq(timetableInstances.academic_year, systemYear),
      eq(timetableInstances.status, 'PUBLISHED')
    ));

    return { data: timetable, meta: { branch, semester, systemYear, rollNo } };
  }
});

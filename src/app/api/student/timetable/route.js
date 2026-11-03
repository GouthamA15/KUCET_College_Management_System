import { wrapHandler, apiError } from '@/lib/api-utils';
import { getBranchFromRoll } from '@/lib/rollNumber';
import { calculateYearAndSemesterAsync } from '@/lib/academic-utils';
import { FacultyService } from '@/services/FacultyService';
import { db } from '@/db';
import { branchTimetable, timetableInstances, syllabusSubjects, staffAccounts } from '@/db/schema';
import { eq, and, sql, or } from 'drizzle-orm';

export const GET = wrapHandler({
  auth: 'student',
  handler: async (req, { user }) => {
    const rollNo = user.roll_no;
    const academicSession = await calculateYearAndSemesterAsync(rollNo, user.academic_offset_years || 0);
    const { semester } = academicSession;
    const branch = getBranchFromRoll(rollNo);
    const systemYear = await FacultyService.getCurrentAcademicYear();

    if (!semester || !branch) {
      return apiError('Unable to resolve academic session or branch from roll number', 400);
    }

    const timetable = await db.select({
      day_of_week: branchTimetable.day_of_week,
      period_number: branchTimetable.period_number,
      batch_number: branchTimetable.batch_number,
      subject_code: branchTimetable.subject_code,
      room_no: branchTimetable.room_no,
      display_name: sql`CASE
        WHEN ${branchTimetable.batch_number} = 1 THEN CONCAT(COALESCE(${syllabusSubjects.subject_name}, ${branchTimetable.subject_code}), ' (Batch 1)')
        WHEN ${branchTimetable.batch_number} = 2 THEN CONCAT(COALESCE(${syllabusSubjects.subject_name}, ${branchTimetable.subject_code}), ' (Batch 2)')
        ELSE COALESCE(${syllabusSubjects.subject_name}, ${branchTimetable.subject_code})
      END`,
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
      eq(timetableInstances.status, 'PUBLISHED'),
      or(
        eq(branchTimetable.batch_number, 0),
        sql`EXISTS (
          SELECT 1 FROM lab_batch_students lbs
          JOIN lab_batch_allocations lba ON lbs.allocation_id = lba.id
          WHERE lbs.student_id = ${user.id}
            AND lbs.batch_number = ${branchTimetable.batch_number}
            AND lba.subject_code = ${branchTimetable.subject_code}
            AND lba.status = 'PUBLISHED'
        )`,
        sql`NOT EXISTS (
          SELECT 1 FROM lab_batch_allocations lba_check
          WHERE lba_check.academic_year = ${systemYear}
            AND lba_check.branch = ${branch}
            AND lba_check.semester = ${semester}
            AND lba_check.subject_code = ${branchTimetable.subject_code}
            AND lba_check.status = 'PUBLISHED'
        )`
      )
    ));

    return { data: timetable, meta: { branch, semester, systemYear, rollNo } };
  }
});

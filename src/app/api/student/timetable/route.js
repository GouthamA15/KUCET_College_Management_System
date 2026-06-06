import { wrapHandler } from '@/lib/api-utils';
import { getCurrentSemester, getBranchFromRoll } from '@/lib/rollNumber';
import { FacultyService } from '@/services/FacultyService';
import { db } from '@/db';
import { collegeInfo as collegeInfoTable } from '@/db/schema';

/**
 * GET /api/student/timetable
 * Fetch current timetable for the logged-in student
 */
export const GET = wrapHandler({
  auth: 'student',
  handler: async (req, { user }) => {
    const rollNo = user.roll_no;

    const collegeRows = await db.select().from(collegeInfoTable).limit(1);
    const collegeInfo = collegeRows[0] || null;

    const semester = getCurrentSemester(rollNo, collegeInfo);
    const branch = getBranchFromRoll(rollNo);

    if (!semester || !branch) throw new Error('ACADEMIC_RESOLUTION_FAILED');

    const systemYear = await FacultyService.getCurrentAcademicYear();
    const timetable = await FacultyService.getBranchTimetable({ 
      branch, 
      semester 
    });

    return { data: timetable, meta: { branch, semester, systemYear, rollNo } };
  }
});

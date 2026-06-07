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

    if (!semester || !branch) {
      const err = new Error('Resolution failed');
      err.status = 400;
      throw err;
    }

    const systemYear = await FacultyService.getCurrentAcademicYear();
    const timetable = await FacultyService.getBranchTimetable({ 
      branch, 
      semester,
      academicYear: systemYear
    });

    return { data: timetable, meta: { branch, semester, systemYear, rollNo } };
  }
});

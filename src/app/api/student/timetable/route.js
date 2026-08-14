import { wrapHandler } from '@/lib/api-utils';
import { getBranchFromRoll } from '@/lib/rollNumber';
import { calculateYearAndSemesterAsync } from '@/lib/academic-utils';
import { FacultyService } from '@/services/FacultyService';

/**
 * GET /api/student/timetable
 * Fetch current timetable for the logged-in student
 */
export const GET = wrapHandler({
  auth: 'student',
  handler: async (req, { user }) => {
    const rollNo = user.roll_no;

    const academicSession = await calculateYearAndSemesterAsync(rollNo, user.academic_offset_years || 0);
    const { semester, status: sessionStatus } = academicSession;
    const branch = getBranchFromRoll(rollNo);

    if (sessionStatus === 'Semester Not Configured') {
      const err = new Error('Academic Calendar not configured.');
      err.status = 400;
      throw err;
    }

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

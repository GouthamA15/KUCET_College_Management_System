import logger from '@/lib/logger';
import { db } from '@/db';
import { students as studentsTable } from '@/db/schema';
import { getBranchFromRoll, branchCodes } from '@/lib/rollNumber';
import { calculateStudentYearAndSemester, getCurrentCalendarSession } from '@/lib/academic-utils';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function GET(_req) {
  const user = await getAuthUser('admin');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const session = await getCurrentCalendarSession();
    const students = await db.select({ roll_no: studentsTable.roll_no }).from(studentsTable);

    const stats = { /* empty */ };
    const allBranchNames = Object.values(branchCodes);
    allBranchNames.forEach(name => {
      stats[name] = { 1: 0, 2: 0, 3: 0, 4: 0, total: 0 };
    });

    for (const student of students) {
      const { roll_no } = student;
      const branch = getBranchFromRoll(roll_no);
      let year = null;
      if (session) {
        const { yearOfStudy } = calculateStudentYearAndSemester(roll_no, session.academicYear, session.semester);
        year = yearOfStudy;
      }

      if (branch && year && stats[branch]) {
        if (stats[branch][year] !== undefined) {
          stats[branch][year]++;
        }
        stats[branch].total++;
      }
    }

    return apiResponse({ data: stats });
  } catch (error) {
    logger.error('Error fetching student stats:', error);
    return apiError('Internal Server Error', 500);
  }
}

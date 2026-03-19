import { db } from '@/db';
import { students as studentsTable, collegeInfo as collegeInfoTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getBranchFromRoll, getCurrentStudyingYear, branchCodes } from '@/lib/rollNumber';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { getNow } from '@/lib/clock';

export async function GET(req) {
  const user = await getAuthUser('admin');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const now = await getNow();
    const collegeRows = await db.select().from(collegeInfoTable).where(eq(collegeInfoTable.id, 1)).limit(1);
    const collegeInfo = collegeRows[0] || null;

    const students = await db.select({ roll_no: studentsTable.roll_no }).from(studentsTable);

    const stats = {};
    const allBranchNames = Object.values(branchCodes);
    allBranchNames.forEach(name => {
      stats[name] = { 1: 0, 2: 0, 3: 0, 4: 0, total: 0 };
    });

    for (const student of students) {
      const { roll_no } = student;
      const branch = getBranchFromRoll(roll_no);
      const year = getCurrentStudyingYear(roll_no, collegeInfo, now);

      if (branch && year && stats[branch]) {
        if (stats[branch][year] !== undefined) {
          stats[branch][year]++;
        }
        stats[branch].total++;
      }
    }

    return apiResponse({ data: stats });
  } catch (error) {
    console.error('Error fetching student stats:', error);
    return apiError('Internal Server Error', 500);
  }
}

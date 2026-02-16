import { query } from '@/lib/db';
import { getBranchFromRoll, getCurrentStudyingYear, branchCodes } from '@/lib/rollNumber';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  // Verify admin
  const user = await getAuthUser('admin');

  if (!user) {
    return apiError('Unauthorized', 401);
  }

  try {
    // Fetch college info for academic year boundary
    const collegeInfoRows = await query('SELECT * FROM college_info WHERE id = 1');
    const collegeInfo = collegeInfoRows.length > 0 ? collegeInfoRows[0] : null;

    const students = await query('SELECT roll_no FROM students');

    const stats = {};

    for (const student of students) {
      const { roll_no } = student;
      const branch = getBranchFromRoll(roll_no);
      const year = getCurrentStudyingYear(roll_no, collegeInfo);

      if (branch && year) {
        if (!stats[branch]) {
          stats[branch] = { 1: 0, 2: 0, 3: 0, 4: 0, total: 0 };
        }
        if (stats[branch][year] !== undefined) {
          stats[branch][year]++;
        }
        stats[branch].total++;
      }
    }

    // Ensure all branches are present in the stats object
    const allBranchNames = Object.values(branchCodes);
    for(const branchName of allBranchNames) {
        if(!stats[branchName]) {
            stats[branchName] = { 1: 0, 2: 0, 3: 0, 4: 0, total: 0 };
        }
    }


    return apiResponse(stats);
  } catch (error) {
    console.error('Error fetching student stats:', error);
    return apiError('Internal Server Error', 500);
  }
}

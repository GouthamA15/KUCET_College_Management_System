import { query } from '@/lib/db';
import { getBranchFromRoll, getCurrentStudyingYear, branchCodes } from '@/lib/rollNumber';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

// Helper to get branch code from branch name
function getBranchCodeFromName(branchName) {
    const entry = Object.entries(branchCodes).find(([, name]) => name === branchName);
    return entry ? entry[0] : null;
}

export async function GET(request) {
  const user = await getAuthUser('admin');

  if (!user) {
    return apiError('Unauthorized', 401);
  }

  const { searchParams } = new URL(request.url);
  const studyingYear = searchParams.get('studyingYear'); // Renamed from 'year'
  const branchName = searchParams.get('branch'); // Renamed to branchName

  if (!studyingYear || !branchName) {
    return apiError('Studying year and branch are required', 400);
  }

  const branchCode = getBranchCodeFromName(branchName);
  if (!branchCode) {
    return apiError('Invalid branch name provided', 400);
  }

  try {
    // Fetch college info for academic year boundary
    const collegeInfoRows = await query('SELECT * FROM college_info WHERE id = 1');
    const collegeInfo = collegeInfoRows.length > 0 ? collegeInfoRows[0] : null;

    // Fetch all students that belong to the given branch code (regardless of entry year for now)
    // We will filter by studyingYear programmatically using rollNumber.js utilities
    const studentsFromDb = await query('SELECT id, roll_no, name FROM students WHERE roll_no LIKE ? OR roll_no LIKE ?', [
      `%T${branchCode}%`, // Regular pattern (e.g., %T09%)
      `%${branchCode}%L`, // Lateral pattern (e.g., %09L)
    ]);

    const filteredStudents = studentsFromDb.filter(student => {
      const studentBranch = getBranchFromRoll(student.roll_no);
      const studentStudyingYear = getCurrentStudyingYear(student.roll_no, collegeInfo);

      return studentBranch === branchName && String(studentStudyingYear) === studyingYear;
    });

    return apiResponse({ students: filteredStudents });
  } catch (error) {
    console.error('Failed to fetch students:', error);
    return apiError('Failed to fetch students', 500);
  }
}
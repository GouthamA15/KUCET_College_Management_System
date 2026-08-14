import logger from '@/lib/logger';
import { db } from '@/db';
import { students } from '@/db/schema';
import { like, or } from 'drizzle-orm';
import { getBranchFromRoll, branchCodes } from '@/lib/rollNumber';
import { calculateStudentYearAndSemester, getCurrentCalendarSession } from '@/lib/academic-utils';
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
  const studyingYear = searchParams.get('studyingYear');
  const branchName = searchParams.get('branch');

  if (!studyingYear || !branchName) {
    return apiError('Studying year and branch are required', 400);
  }

  const branchCode = getBranchCodeFromName(branchName);
  if (!branchCode) {
    return apiError('Invalid branch name provided', 400);
  }

  try {
    const session = await getCurrentCalendarSession();

    // Fetch all students that belong to the given branch code (regardless of entry year for now)
    const studentsFromDb = await db.select({
      id: students.id,
      roll_no: students.roll_no,
      name: students.name
    })
    .from(students)
    .where(or(
      like(students.roll_no, `%T${branchCode}%`),
      like(students.roll_no, `%${branchCode}%L`)
    ));

    const filteredStudents = studentsFromDb.filter(student => {
      const studentBranch = getBranchFromRoll(student.roll_no);
      let studentStudyingYear = null;
      if (session) {
        const { yearOfStudy } = calculateStudentYearAndSemester(student.roll_no, session.academicYear, session.semester);
        studentStudyingYear = yearOfStudy;
      }

      return studentBranch === branchName && String(studentStudyingYear) === studyingYear;
    });

    return apiResponse({ students: filteredStudents });
  } catch (error) {
    logger.error('Failed to fetch students:', error);
    return apiError('Failed to fetch students', 500);
  }
}

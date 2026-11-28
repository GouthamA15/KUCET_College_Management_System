import logger from '@/lib/logger';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { StreakService } from '@/services/attendance/StreakService';

export async function GET(request) {
  try {
    const user = await getAuthUser('student');
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const querySemester = searchParams.get('semester');
    const queryAcademicYear = searchParams.get('academic_year');

    const parsedSemester = querySemester ? parseInt(querySemester, 10) : undefined;
    const parsedAcademicYear = queryAcademicYear || undefined;

    // NOTE: Policy is resolved EXCLUSIVELY on the server from trusted institutional configuration.
    // Client-supplied parameters (e.g. ?policy=...) are strictly ignored to prevent manipulation.
    // For full lifetime summary queries (default dashboard load), use derived snapshot cache with
    // automatic stale/version validation (`getSnapshotOrRecalculate`).
    const streakData = (!parsedSemester && !parsedAcademicYear)
      ? await StreakService.getSnapshotOrRecalculate({
          studentId: user.student_id,
          rollNo: user.roll_no,
        })
      : await StreakService.calculateStudentStreak({
          studentId: user.student_id,
          rollNo: user.roll_no,
          semester: parsedSemester,
          academicYear: parsedAcademicYear,
        });

    // Strip full timeline from summary payload to keep response lightweight
    const { timeline: _timeline, ...summary } = streakData;

    return apiResponse({
      success: true,
      data: summary,
    });
  } catch (error) {
    logger.error('Fetch Student Streak Summary Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

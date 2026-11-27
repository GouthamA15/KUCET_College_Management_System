import logger from '@/lib/logger';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { StreakService } from '@/services/attendance/StreakService';
import { computeAttendanceAnalytics } from '@/lib/streak-config';

export async function GET(request) {
  try {
    const user = await getAuthUser('student');
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const querySemester = searchParams.get('semester');
    const queryAcademicYear = searchParams.get('academic_year');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const filterSubject = searchParams.get('subject_code');

    const streakData = await StreakService.calculateStudentStreak({
      studentId: user.student_id,
      rollNo: user.roll_no,
      semester: querySemester ? parseInt(querySemester, 10) : undefined,
      academicYear: queryAcademicYear || undefined,
    });

    let timeline = streakData.timeline || [];

    if (filterSubject && filterSubject !== 'ALL') {
      timeline = timeline.filter((item) => item.subjectCode === filterSubject);
    }
    if (startDate) {
      timeline = timeline.filter((item) => String(item.date) >= startDate);
    }
    if (endDate) {
      timeline = timeline.filter((item) => String(item.date) <= endDate);
    }

    const analytics = computeAttendanceAnalytics(timeline);

    return apiResponse({
      success: true,
      data: {
        currentStreak: streakData.currentStreak,
        longestStreak: streakData.longestStreak,
        previousStreak: streakData.previousStreak,
        recognitionBadges: streakData.recognitionBadges || [],
        ...analytics,
      },
    });
  } catch (error) {
    logger.error('Fetch Student Attendance Analytics Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

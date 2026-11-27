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
    const filterSubject = searchParams.get('subject_code');
    const filterStatus = searchParams.get('status');

    // NOTE: Policy is resolved EXCLUSIVELY on the server from trusted institutional configuration.
    // Client-supplied parameters (e.g. ?policy=...) are strictly ignored to prevent manipulation.
    const streakData = await StreakService.calculateStudentStreak({
      studentId: user.student_id,
      rollNo: user.roll_no,
      semester: querySemester ? parseInt(querySemester, 10) : undefined,
      academicYear: queryAcademicYear || undefined,
    });

    let timeline = streakData.timeline || [];

    // Optional filters for subject and status
    if (filterSubject) {
      timeline = timeline.filter(item => item.subjectCode === filterSubject);
    }

    if (filterStatus) {
      if (filterStatus === 'PRESENT') {
        timeline = timeline.filter(item => item.isAttended);
      } else if (filterStatus === 'ABSENT') {
        timeline = timeline.filter(item => !item.isAttended);
      }
    }

    return apiResponse({
      success: true,
      currentStreak: streakData.currentStreak,
      longestStreak: streakData.longestStreak,
      totalClasses: timeline.length,
      timeline,
    });
  } catch (error) {
    logger.error('Fetch Student Streak History Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

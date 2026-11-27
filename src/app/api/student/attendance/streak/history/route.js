import logger from '@/lib/logger';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { StreakService } from '@/services/attendance/StreakService';
import { sortTimelineDescending } from '@/lib/streak-config';

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
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');

    // NOTE: Policy is resolved EXCLUSIVELY on the server from trusted institutional configuration.
    // Client-supplied parameters (e.g. ?policy=...) are strictly ignored to prevent manipulation.
    const streakData = await StreakService.calculateStudentStreak({
      studentId: user.student_id,
      rollNo: user.roll_no,
      semester: querySemester ? parseInt(querySemester, 10) : undefined,
      academicYear: queryAcademicYear || undefined,
    });

    // Global descending chronological order: latest date first -> latest period first -> stable sessionId DESC
    let timeline = sortTimelineDescending(streakData.timeline || []);

    // Optional filters for subject, status, and date range (preserving descending order)
    if (filterSubject && filterSubject !== 'ALL') {
      timeline = timeline.filter(item => item.subjectCode === filterSubject);
    }

    if (filterStatus && filterStatus !== 'ALL') {
      if (filterStatus === 'PRESENT') {
        timeline = timeline.filter(item => item.isAttended);
      } else if (filterStatus === 'ABSENT') {
        timeline = timeline.filter(item => !item.isAttended);
      } else {
        timeline = timeline.filter(item => item.status === filterStatus);
      }
    }

    if (startDate) {
      timeline = timeline.filter(item => String(item.date) >= startDate);
    }

    if (endDate) {
      timeline = timeline.filter(item => String(item.date) <= endDate);
    }

    const totalClasses = timeline.length;

    // Optional server-side pagination over the globally descending-ordered & filtered timeline
    let pagination = null;
    if (pageParam || limitParam) {
      const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(limitParam || '25', 10) || 25));
      const totalPages = Math.max(1, Math.ceil(totalClasses / limit));
      const offset = (page - 1) * limit;
      timeline = timeline.slice(offset, offset + limit);
      pagination = {
        page,
        limit,
        total: totalClasses,
        totalPages,
        hasMore: page < totalPages,
      };
    }

    return apiResponse({
      success: true,
      currentStreak: streakData.currentStreak,
      longestStreak: streakData.longestStreak,
      totalClasses,
      order: 'DESC',
      ...(pagination ? { pagination } : {}),
      timeline,
    });
  } catch (error) {
    logger.error('Fetch Student Streak History Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

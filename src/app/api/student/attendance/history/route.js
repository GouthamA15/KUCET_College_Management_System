import logger from '@/lib/logger';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { UnifiedAttendanceRepository } from '@/services/attendance/UnifiedAttendanceRepository';

export async function GET(request) {
  try {
    const user = await getAuthUser('student');
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const assignment_id = searchParams.get('assignment_id');
    const assignmentIdNum = parseInt(assignment_id || '', 10);

    if (!assignment_id || !Number.isInteger(assignmentIdNum) || assignmentIdNum <= 0) {
      return apiError('Valid Assignment ID is required', 400);
    }

    const history = await UnifiedAttendanceRepository.getStudentSubjectHistory(
      user.student_id,
      assignmentIdNum
    );

    return apiResponse({ data: history });
  } catch (error) {
    logger.error('Student Attendance History Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

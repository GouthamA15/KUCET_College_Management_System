import logger from '@/lib/logger';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { StudentService } from '@/services/StudentService';

export async function GET() {
  try {
    const user = await getAuthUser('student');
    if (!user || !user.student_id || !user.roll_no) {
      return apiError('Unauthorized', 401);
    }

    const eligibility = await StudentService.getBonafideEligibility(user.student_id, user.roll_no);
    return apiResponse(eligibility);
  } catch (error) {
    logger.error('Error fetching Bonafide eligibility:', error);
    return apiError('Internal Server Error', 500);
  }
}

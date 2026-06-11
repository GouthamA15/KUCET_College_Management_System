import logger from '@/lib/logger';
import { StudentService } from '@/services/StudentService';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function GET(req, context) {
  // Check any valid auth
  const user = await getAuthUser();

  if (!user) {
    return apiError('Unauthorized', 401);
  }

  try {
    const params = await context.params;
    let { rollno } = params;

    // Normalize
    rollno = String(rollno || '').trim().toUpperCase();

    // SECURITY GUARD: A student can ONLY access their own profile.
    // Staff (clerk/admin) can access any profile.
    const isStudent = !!user.roll_no;
    if (isStudent && user.roll_no !== rollno) {
      logger.warn(`[SECURITY_ALERT] Student ${user.roll_no} tried to access profile ${rollno}`);
      return apiError('Forbidden: Access denied to this profile', 403);
    }

    // Use Service Layer for robust data fetching
    const profile = await StudentService.getStudentProfile(rollno);

    if (!profile) {
      return apiError('Student not found', 404);
    }

    return apiResponse(profile);
  } catch (error) {
    logger.error({ err: error.message, rollno: context.params?.rollno }, 'Error fetching student profile data');
    return apiError('Failed to fetch student profile data', 500, error.message);
  }
}

import logger from '@/lib/logger';
import { FacultyService } from '@/services/FacultyService';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  let user;
  try {
    user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty' || !user.is_hod) {
      return apiError('Unauthorized', 401);
    }

    if (!user.branch) {
      logger.warn(`HOD ${user.email} accessed faculty-load without an assigned branch.`);
      return apiError('Branch not assigned to your profile. Please contact Admin.', 400);
    }

    // Use FacultyService to resolve academic year and load
    const systemYear = await FacultyService.getCurrentAcademicYear();
    const facultyLoad = await FacultyService.getFacultyLoad(systemYear);

    return apiResponse({ 
      data: facultyLoad,
      meta: { systemYear }
    });
  } catch (error) {
    logger.error({ err: error, user: user?.email, branch: user?.branch }, 'Faculty Load API Error');
    return apiError('Internal Server Error', 500, error.message);
  }
}

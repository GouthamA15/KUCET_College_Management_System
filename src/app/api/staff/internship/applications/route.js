import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { StudentInternshipService } from '@/services/internships/StudentInternshipService';
import logger from '@/lib/logger';

export async function GET(req) {
  try {
    const user = await getAuthUser('internship_coordinator');
    if (!user) {
      return apiError('Forbidden: Access restricted to the designated Internship Coordinator or Administrator', 403);
    }

    const { searchParams } = new URL(req.url);
    const page = searchParams.get('page') || 1;
    const limit = searchParams.get('limit') || 20;
    const queueType = searchParams.get('queue') || 'ALL'; // 'INTERNAL_APPLICATIONS' | 'EXTERNAL_REGISTRATIONS' | 'PENDING_COMPLETIONS' | 'ACTION_REQUIRED' | 'ALL'
    const branch = searchParams.get('branch') || 'ALL';
    const academicYear = searchParams.get('academicYear') || 'ALL';
    const status = searchParams.get('status') || 'ALL';
    const search = searchParams.get('search') || '';

    const result = await StudentInternshipService.getCoordinatorApplicationsQueue({
      page,
      limit,
      queueType,
      branch,
      academicYear,
      status,
      search,
    });

    return apiResponse({
      success: true,
      data: result,
    });
  } catch (err) {
    logger.error({ err: err.message }, '[GET_COORDINATOR_APPLICATIONS_ERROR]');
    return apiError(err.message, 500);
  }
}

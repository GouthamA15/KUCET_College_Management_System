import { apiResponse, apiError, wrapHandler } from '@/lib/api-utils';
import { AcademicMonitoringService } from '@/services/academic/AcademicMonitoringService';
import logger from '@/lib/logger';

export const GET = wrapHandler({
  auth: ['faculty', 'admin'],
  handler: async (request, { user }) => {
    try {
      const { searchParams } = new URL(request.url);
      const branch = searchParams.get('branch');
      const semester = searchParams.get('semester');
      const academicYear = searchParams.get('academic_year') || searchParams.get('year');

      const data = await AcademicMonitoringService.getAcademicOverview({
        user,
        branch,
        semester,
        academicYear
      });

      return apiResponse({ data });
    } catch (err) {
      const status = err.statusCode || err.status || 500;
      if (status >= 500) {
        logger.error({ err, url: request.url }, '[ACADEMIC_MONITORING_OVERVIEW_ERR]');
      }
      return apiError(err.message || 'Internal Server Error', status);
    }
  }
});

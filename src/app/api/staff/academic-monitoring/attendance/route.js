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
      const search = searchParams.get('search');
      const page = searchParams.get('page') || 1;
      const limit = searchParams.get('limit') || 50;

      const data = await AcademicMonitoringService.getCohortAttendance({
        user,
        branch,
        semester,
        academicYear,
        search,
        page,
        limit
      });

      return apiResponse({ data });
    } catch (err) {
      const status = err.statusCode || err.status || 500;
      if (status >= 500) {
        logger.error({ err, url: request.url }, '[ACADEMIC_MONITORING_ATTENDANCE_ERR]');
      }
      return apiError(err.message || 'Internal Server Error', status);
    }
  }
});

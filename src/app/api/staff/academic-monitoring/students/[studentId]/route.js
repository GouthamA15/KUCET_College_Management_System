import { apiResponse, apiError, wrapHandler } from '@/lib/api-utils';
import { AcademicMonitoringService } from '@/services/academic/AcademicMonitoringService';
import logger from '@/lib/logger';

export const GET = wrapHandler({
  auth: ['faculty', 'admin'],
  handler: async (request, { user, context }) => {
    try {
      const params = await context?.params;
      const studentId = parseInt(params?.studentId, 10);
      if (!studentId || isNaN(studentId) || studentId <= 0) {
        return apiError('Valid student ID is required', 400);
      }

      const { searchParams } = new URL(request.url);
      const branch = searchParams.get('branch');
      const semester = searchParams.get('semester');
      const academicYear = searchParams.get('academic_year') || searchParams.get('year');

      const data = await AcademicMonitoringService.getStudentAcademicDetails({
        user,
        studentId,
        branch,
        semester,
        academicYear
      });

      return apiResponse({ data });
    } catch (err) {
      const status = err.statusCode || err.status || 500;
      if (status >= 500) {
        logger.error({ err, url: request.url }, '[ACADEMIC_MONITORING_STUDENT_ERR]');
      }
      return apiError(err.message || 'Internal Server Error', status);
    }
  }
});

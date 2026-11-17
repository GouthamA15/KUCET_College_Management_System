import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { InternshipReportingService } from '@/services/internships/InternshipReportingService';
import logger from '@/lib/logger';

export async function GET(req) {
  try {
    const user = await getAuthUser('internship_coordinator');
    if (!user) {
      return apiError('Forbidden: Access restricted to the designated Internship Coordinator or Administrator', 403);
    }

    const { searchParams } = new URL(req.url);
    const reportType = searchParams.get('reportType');
    const branch = searchParams.get('branch') || 'ALL';
    const academicYear = searchParams.get('academicYear') || 'ALL';
    const studentSearch = searchParams.get('studentSearch') || '';
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50));

    if (reportType) {
      const report = await InternshipReportingService.getReportData({
        reportType,
        branch,
        academicYear,
        studentSearch,
        page,
        limit,
      });

      return apiResponse({
        success: true,
        data: report,
      });
    }

    const analytics = await InternshipReportingService.getAnalytics({
      branch,
      academicYear,
    });

    return apiResponse({
      success: true,
      data: analytics,
    });
  } catch (err) {
    logger.error({ err: err.message }, '[GET_INTERNSHIP_REPORTS_ERROR]');
    return apiError(err.message, 500);
  }
}

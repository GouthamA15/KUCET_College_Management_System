import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { InternshipCompanyService } from '@/services/internships/InternshipCompanyService';
import logger from '@/lib/logger';

export async function GET(req) {
  try {
    const user = await getAuthUser('student');
    if (!user) return apiError('Unauthorized', 401);

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || searchParams.get('search') || '';
    const limit = Number(searchParams.get('limit')) || 20;

    const companies = await InternshipCompanyService.searchCompanies({
      query,
      limit,
      verifiedOnly: false, // Students can see both verified & existing companies to prevent duplicate entry
    });

    return apiResponse({
      success: true,
      data: companies,
    });
  } catch (err) {
    logger.error({ err: err.message }, '[GET_STUDENT_COMPANIES_ERROR]');
    return apiError(err.message, 500);
  }
}

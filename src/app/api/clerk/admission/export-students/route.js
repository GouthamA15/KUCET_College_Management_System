import logger from '@/lib/logger';
import { getAuthUser } from '@/lib/api-utils';
import { StudentService } from '@/services/StudentService';
import { apiError, apiResponse } from '@/lib/api-utils';

export async function GET(req) {
  try {
    const user = await getAuthUser('clerk');
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(req.url);
    const branch = searchParams.get('branch');
    const year = searchParams.get('year');

    if (!branch || !year) {
      return apiError('Branch and Year are required.', 400);
    }

    const students = await StudentService.getFullStudentDataForExport(year, branch);

    return apiResponse({ students });

  } catch (error) {
    logger.error(error, 'Error exporting student data');
    return apiError('Internal Server Error', 500);
  }
}

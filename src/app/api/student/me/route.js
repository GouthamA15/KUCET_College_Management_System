import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  try {
    const user = await getAuthUser('student');

    if (!user) {
      return apiError('Unauthorized', 401);
    }

    return apiResponse({ roll_no: user.roll_no });
  } catch (error) {
    console.error('API /student/me error:', error);
    return apiError('Internal Server Error', 500);
  }
}

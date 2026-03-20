import logger from '@/lib/logger';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET() {
  try {
    const user = await getAuthUser('admin');

    if (!user) {
      return apiError('Unauthorized', 401);
    }

    return apiResponse({ valid: true, admin: user });

  } catch (error) {
    logger.error('Admin token verification error:', error);
    return apiError('Invalid token', 401);
  }
}
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { ClerkRegistrationService } from '@/services/identity/ClerkRegistrationService';
import logger from '@/lib/logger';

export async function GET(req) {
  try {
    const admin = await getAuthUser('admin');
    if (!admin) {
      return apiError('Unauthorized admin access', 401);
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'PENDING';

    const requests = await ClerkRegistrationService.getRequests(status);

    return apiResponse({
      success: true,
      requests
    });
  } catch (error) {
    logger.error(error, '[ADMIN_CLERK_REQUESTS_GET_ERROR]');
    return apiError('Failed to fetch clerk registration requests', 500);
  }
}

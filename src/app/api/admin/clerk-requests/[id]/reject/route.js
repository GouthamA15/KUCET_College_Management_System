import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { ClerkRegistrationService } from '@/services/identity/ClerkRegistrationService';
import logger from '@/lib/logger';

export async function POST(req, { params }) {
  try {
    const admin = await getAuthUser('admin');
    if (!admin) {
      return apiError('Unauthorized admin access', 401);
    }

    const { id } = await params;
    const requestId = parseInt(id, 10);
    if (isNaN(requestId)) {
      return apiError('Invalid request ID', 400);
    }

    const body = await req.json().catch(() => ({}));
    const reason = body.reason || '';

    const result = await ClerkRegistrationService.rejectRequest(requestId, admin.id || 1, reason);

    return apiResponse(result);
  } catch (error) {
    logger.error(error, '[ADMIN_CLERK_REJECT_ERROR]');
    return apiError(error.message || 'Failed to reject clerk registration request', 400);
  }
}

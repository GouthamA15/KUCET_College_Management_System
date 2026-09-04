import logger from '@/lib/logger';
import { apiResponse, apiError } from '@/lib/api-utils';
import { handleLogoutRevocation, clearAllAuthCookies } from '@/lib/auth-utils';

export async function POST(request) {
  try {
    if (request) {
      await handleLogoutRevocation(request, 'admin');
    }

    const response = apiResponse(
      { success: true, message: 'Admin logout successful' },
      200,
      { 'Clear-Site-Data': '"cache", "storage"' }
    );

    clearAllAuthCookies(response);
    return response;
  } catch (error) {
    logger.error('Admin Logout error:', error);
    return apiError('An internal server error occurred.', 500);
  }
}
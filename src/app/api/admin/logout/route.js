import logger from '@/lib/logger';
import { apiResponse, apiError } from '@/lib/api-utils';

export async function POST() {
  try {
    const response = apiResponse(
      { success: true, message: 'Admin logout successful' },
      200,
      { 'Clear-Site-Data': '"cache", "storage"' }
    );

    // Clear admin cookies
    const cookiesToClear = [
      'admin_auth', 'admin_logged_in', 'admin_refresh_token', 'admin_session_id', 'session_id'
    ];
    cookiesToClear.forEach(name => {
      response.cookies.delete(name);
    });

    return response;
  } catch (error) {
    logger.error('Admin Logout error:', error);
    return apiError('An internal server error occurred.', 500);
  }
}
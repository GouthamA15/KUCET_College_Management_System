import logger from '@/lib/logger';
import { apiResponse, apiError } from '@/lib/api-utils';

export async function POST() {
  try {
    const response = apiResponse({ success: true, message: 'Admin logout successful' });

    // Clear admin cookies by setting them to expire immediately
    response.cookies.set('admin_auth', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      expires: new Date(0), // Expire immediately
      path: '/',
    });
    response.cookies.set('admin_logged_in', '', {
      httpOnly: false,
      secure: true,
      sameSite: 'lax',
      expires: new Date(0), // Expire immediately
      path: '/',
    });

    return response;
  } catch (error) {
    logger.error('Admin Logout error:', error);
    return apiError('An internal server error occurred.', 500);
  }
}
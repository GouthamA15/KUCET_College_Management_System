import { apiResponse } from '@/lib/api-utils';
import { handleLogoutRevocation, clearAllAuthCookies } from '@/lib/auth-utils';

export async function POST(request) {
  if (request) {
    await handleLogoutRevocation(request, 'staff');
  }

  const response = apiResponse(
    { success: true, message: 'Logout successful' },
    200,
    { 'Clear-Site-Data': '"cache", "storage"' }
  );

  clearAllAuthCookies(response);
  return response;
}


import { apiResponse } from '@/lib/api-utils';

export async function POST() {
  const response = apiResponse({ success: true, message: 'Logout successful' });
  const cookiesToClear = [
    'clerk_auth', 'clerk_logged_in', 'clerk_refresh_token', 'clerk_role', 'clerk_session_id', 'session_id'
  ];
  cookiesToClear.forEach(name => {
    response.cookies.delete(name);
  });
  return response;
}

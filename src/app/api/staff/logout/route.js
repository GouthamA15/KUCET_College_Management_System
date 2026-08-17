import { apiResponse } from '@/lib/api-utils';

export async function POST() {
  const response = apiResponse({ success: true, message: 'Logout successful' });
  const cookiesToClear = [
    'staff_auth', 'staff_logged_in', 'staff_refresh_token', 'staff_role', 'staff_session_id', 'session_id'
  ];
  cookiesToClear.forEach(name => {
    response.cookies.delete(name);
  });
  return response;
}

import { apiResponse } from '@/lib/api-utils';

export async function POST() {
  const response = apiResponse({ success: true, message: 'Logout successful' });
  response.cookies.set('clerk_auth', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    expires: new Date(0),
    path: '/',
  });
  response.cookies.set('clerk_logged_in', '', {
    httpOnly: false,
    secure: true,
    sameSite: 'lax',
    expires: new Date(0),
    path: '/',
  });
  response.cookies.set('clerk_role', '', {
    httpOnly: false,
    secure: true,
    sameSite: 'lax',
    expires: new Date(0),
    path: '/',
  });
  return response;
}

import { apiResponse } from '@/lib/api-utils';

export async function POST() {
  const response = apiResponse({ success: true, message: 'Logout successful' });
  response.cookies.set('student_auth', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: new Date(0),
    path: '/',
  });
  return response;
}

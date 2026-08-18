import { apiResponse } from '@/lib/api-utils';

export async function POST() {
  const response = apiResponse(
    { success: true, message: 'Logout successful' },
    200,
    { 'Clear-Site-Data': '"cache", "storage"' }
  );
  const cookiesToClear = [
    'student_auth', 'student_logged_in', 'student_refresh_token', 'student_session_id', 'session_id'
  ];
  cookiesToClear.forEach(name => {
    response.cookies.delete(name);
  });
  return response;
}

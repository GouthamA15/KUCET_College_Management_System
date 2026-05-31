import { apiResponse } from '@/lib/api-utils';

export async function GET(request) {
  const response = apiResponse({ success: true, message: 'Logged out' });
  
  // Clear all potential auth cookies
  const cookiesToClear = [
    'admin_auth', 'admin_logged_in', 'admin_refresh_token',
    'clerk_auth', 'clerk_logged_in', 'clerk_refresh_token', 'clerk_role',
    'student_auth', 'student_logged_in', 'student_refresh_token',
    'session_id'
  ];

  cookiesToClear.forEach(name => {
    response.cookies.delete(name);
  });

  const { searchParams } = new URL(request.url);
  const revoked = searchParams.get('revoked');
  
  if (revoked === 'true') {
    return Response.redirect(new URL('/?revoked=true', request.url));
  }

  return Response.redirect(new URL('/', request.url));
}

export async function POST(request) {
  const response = apiResponse({ success: true, message: 'Logged out' });
  
  const cookiesToClear = [
    'admin_auth', 'admin_logged_in', 'admin_refresh_token',
    'clerk_auth', 'clerk_logged_in', 'clerk_refresh_token', 'clerk_role',
    'student_auth', 'student_logged_in', 'student_refresh_token',
    'session_id'
  ];

  cookiesToClear.forEach(name => {
    response.cookies.delete(name);
  });

  return response;
}

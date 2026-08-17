import { apiResponse } from '@/lib/api-utils';

import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const revoked = searchParams.get('revoked');
  
  const redirectUrl = new URL(revoked === 'true' ? '/?revoked=true' : '/', request.url);
  const response = NextResponse.redirect(redirectUrl);
  
  // Clear all potential auth cookies
  const cookiesToClear = [
    'admin_auth', 'admin_logged_in', 'admin_refresh_token', 'admin_session_id',
    'staff_auth', 'staff_logged_in', 'staff_refresh_token', 'staff_role', 'staff_session_id',
    'student_auth', 'student_logged_in', 'student_refresh_token', 'student_session_id',
    'session_id'
  ];

  cookiesToClear.forEach(name => {
    response.cookies.delete(name);
  });

  return response;
}

export async function POST(_request) {
  const response = apiResponse({ success: true, message: 'Logged out' });
  
  const cookiesToClear = [
    'admin_auth', 'admin_logged_in', 'admin_refresh_token', 'admin_session_id',
    'staff_auth', 'staff_logged_in', 'staff_refresh_token', 'staff_role', 'staff_session_id',
    'student_auth', 'student_logged_in', 'student_refresh_token', 'student_session_id',
    'session_id'
  ];

  cookiesToClear.forEach(name => {
    response.cookies.delete(name);
  });

  return response;
}

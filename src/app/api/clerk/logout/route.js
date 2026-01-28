import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Logout successful' });
  response.cookies.set('clerk_auth', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: new Date(0),
    path: '/',
  });
  response.cookies.set('clerk_logged_in', '', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    expires: new Date(0),
    path: '/',
  });
  response.cookies.set('clerk_role', '', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    expires: new Date(0),
    path: '/',
  });
  return response;
}

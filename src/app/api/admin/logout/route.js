import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const response = NextResponse.json({ success: true, message: 'Admin logout successful' });

    // Clear admin cookies by setting them to expire immediately
    response.cookies.set('admin_auth', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      expires: new Date(0), // Expire immediately
      path: '/',
    });
    response.cookies.set('admin_logged_in', '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      expires: new Date(0), // Expire immediately
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Admin Logout error:', error);
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
}
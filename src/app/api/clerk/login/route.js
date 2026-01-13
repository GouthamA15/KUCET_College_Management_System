import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (email === 'clerk@test.com' && password === 'password') {
      const response = NextResponse.json({ success: true, message: 'Login successful' });
      // Set a cookie to manage the session
      response.cookies.set('clerk_auth', 'true', {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        maxAge: 60 * 60, // 1 hour
        path: '/',
      });
      return response;
    } else {
      return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
    }
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ success: false, message: 'An internal server error occurred.' }, { status: 500 });
  }
}

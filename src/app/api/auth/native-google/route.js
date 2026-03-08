import { OAuth2Client } from 'google-auth-library';
import { query } from '@/lib/db';
import { SignJWT } from 'jose';
import { apiResponse, apiError } from '@/lib/api-utils';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function POST(request) {
  try {
    const { idToken } = await request.json();

    if (!idToken) {
      return apiError('ID Token is required', 400);
    }

    // 1. Verify the Google Token
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload.email;

    if (!email) {
      return apiError('Email not found in Google token', 400);
    }

    // 2. Check if clerk exists in database
    const results = await query('SELECT * FROM clerks WHERE email = ?', [email]);

    if (results.length === 0) {
      return apiError('No clerk found with this email', 404);
    }

    const clerk = results[0];

    // 3. Block deactivated clerks
    if (!clerk.is_active) {
      return apiError('Your account has been deactivated. Please contact the administrator.', 403);
    }

    // 4. Create JWT session
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const sessionDuration = '30d'; // Native apps usually stay logged in longer
    const cookieMaxAge = 30 * 24 * 60 * 60;

    const token = await new SignJWT({ 
      id: clerk.id, 
      clerkId: clerk.id, 
      email: clerk.email, 
      role: clerk.role 
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(sessionDuration)
      .sign(secret);

    const response = apiResponse({ 
      success: true, 
      message: 'Native login successful', 
      role: clerk.role 
    });

    // Clear other auth cookies
    response.cookies.delete('admin_auth');
    response.cookies.delete('student_auth');

    // Set Clerk Auth Cookies
    response.cookies.set('clerk_auth', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: cookieMaxAge,
      path: '/',
    });
    response.cookies.set('clerk_logged_in', 'true', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      maxAge: cookieMaxAge,
      path: '/',
    });
    response.cookies.set('clerk_role', clerk.role || '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      maxAge: cookieMaxAge,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Native Google Login Error:', error);
    return apiError('Native authentication failed', 500);
  }
}

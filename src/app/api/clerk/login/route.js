import { db } from '@/db';
import { clerks } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { SignJWT } from 'jose';
import { apiResponse, apiError } from '@/lib/api-utils';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'anonymous';
    const rateCheck = await checkRateLimit(`login_clerk:${ip}`, 5, 900); // 5 attempts per 15 min
    
    if (!rateCheck.success) {
      return apiError('Too many login attempts. Please try again later.', 429);
    }

    const { email, password, rememberMe } = await request.json();

    if (!email || !password) {
      return apiError('Email and password are required', 400);
    }

    const results = await db.select().from(clerks).where(eq(clerks.email, email)).limit(1);

    if (results.length === 0) {
      console.error(`[Clerk Login Failed] User not found for email: ${email}`);
      return apiError('Invalid credentials', 401);
    }

    const clerk = results[0];
    const passwordMatch = await bcrypt.compare(password, clerk.password_hash);

    if (!passwordMatch) {
      console.error(`[Clerk Login Failed] Password mismatch for email: ${email}`);
      return apiError('Invalid credentials', 401);
    }

    if (!clerk.is_active) {
      console.log(`[Clerk Login] Attempt to login to deactivated account: ${email}`);
      return apiError('Your account has been deactivated. Please contact the administrator.', 403);
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const sessionDuration = rememberMe ? '30d' : '1h';
    const cookieMaxAge = rememberMe ? 30 * 24 * 60 * 60 : 60 * 60;

    const token = await new SignJWT({ 
      id: clerk.id, 
      clerkId: clerk.id, 
      email: clerk.email, 
      role: clerk.role,
      is_hod: !!clerk.is_hod,
      branch: clerk.branch 
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(sessionDuration)
      .sign(secret);

    const response = apiResponse({ success: true, message: 'Login successful', role: clerk.role });

    response.cookies.delete('admin_auth');
    response.cookies.delete('student_auth');

    response.cookies.set('clerk_auth', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: cookieMaxAge,
      path: '/',
    });
    response.cookies.set('clerk_logged_in', 'true', {
      httpOnly: false,
      secure: true,
      sameSite: 'lax',
      maxAge: cookieMaxAge,
      path: '/',
    });
    response.cookies.set('clerk_role', clerk.role || '', {
      httpOnly: false,
      secure: true,
      sameSite: 'lax',
      maxAge: cookieMaxAge,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return apiError('An internal server error occurred.', 500);
  }
}

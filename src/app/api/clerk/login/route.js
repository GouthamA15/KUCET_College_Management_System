import { db } from '@/db';
import { clerks } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { apiResponse, apiError } from '@/lib/api-utils';
import { checkRateLimit } from '@/lib/rate-limit';
import { issueClerkAuthCookie } from '@/lib/auth-utils';
import logger from '@/lib/logger';

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
      logger.warn({ email }, '[Clerk Login Failed] User not found');
      return apiError('Invalid credentials', 401);
    }

    const clerk = results[0];
    const passwordMatch = await bcrypt.compare(password, clerk.password_hash);

    if (!passwordMatch) {
      logger.warn({ email }, '[Clerk Login Failed] Password mismatch');
      return apiError('Invalid credentials', 401);
    }

    if (!clerk.is_active) {
      logger.info({ email }, '[Clerk Login] Attempt to login to deactivated account');
      return apiError('Your account has been deactivated. Please contact the administrator.', 403);
    }

    const response = apiResponse({ success: true, message: 'Login successful', role: clerk.role });

    response.cookies.delete('admin_auth');
    response.cookies.delete('student_auth');

    // Log Security Event & Update Last Login
    const SecurityService = (await import('@/services/SecurityService')).default;
    await SecurityService.updateLastLogin('CLERK', clerk.id, ip);
    await SecurityService.logSecurityEvent({
      userType: 'CLERK',
      userId: clerk.id,
      eventType: 'LOGIN_SUCCESS',
      ipAddress: ip
    });

    const userAgent = request.headers.get('user-agent') || 'Unknown';
    await issueClerkAuthCookie(response, clerk, rememberMe, ip, userAgent);

    return response;
  } catch (error) {
    logger.error(error, 'Login error');
    return apiError('An internal server error occurred.', 500);
  }
}

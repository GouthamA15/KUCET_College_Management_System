import { db } from '@/db';
import { principal } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { apiResponse, apiError } from '@/lib/api-utils';
import { checkRateLimit } from '@/lib/rate-limit';
import { issueAdminAuthCookie } from '@/lib/auth-utils';
import logger from '@/lib/logger';

export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'anonymous';       
    const rateCheck = await checkRateLimit(`login_admin:${ip}`, 5, 900); // 5 attempts per 15 min

    if (!rateCheck.success) {
      return apiError('Too many login attempts. Please try again later.', 429);
    }

    const { email, password, rememberMe } = await request.json();
    if (!email || !password) {
      return apiError('Email and password are required', 400);
    }

    const rows = await db.select({ id: principal.id, email: principal.email, password_hash: principal.password_hash })
      .from(principal)
      .where(eq(principal.email, email))
      .limit(1);

    if (rows.length === 0) {
      logger.warn({ email }, '[Admin Login Failed] User not found');
      return apiError('Invalid credentials', 401);
    }

    const admin = rows[0];
    const isValidPassword = await bcrypt.compare(password, admin.password_hash);

    if (!isValidPassword) {
      logger.warn({ email }, '[Admin Login Failed] Password mismatch');
      return apiError('Invalid credentials', 401);
    }

    const response = apiResponse({ success: true, message: 'Admin login successful' });

    // Clear other auth cookies
    response.cookies.delete('clerk_auth');
    response.cookies.delete('student_auth');

    await issueAdminAuthCookie(response, admin, rememberMe);

    return response;

  } catch (error) {
    logger.error(error, 'Admin Login error');
    return apiError('An internal server error occurred.', 500);
  }
}

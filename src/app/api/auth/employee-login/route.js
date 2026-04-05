import { db } from '@/db';
import { clerks, principal } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { apiResponse, apiError } from '@/lib/api-utils';
import { checkRateLimit } from '@/lib/rate-limit';
import { issueClerkAuthCookie, issueAdminAuthCookie } from '@/lib/auth-utils';
import logger from '@/lib/logger';

export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'anonymous';
    const rateCheck = await checkRateLimit(`login_employee:${ip}`, 5, 900); // 5 attempts per 15 min
    
    if (!rateCheck.success) {
      return apiError('Too many login attempts. Please try again later.', 429);
    }

    const { email, password, rememberMe } = await request.json();

    if (!email || !password) {
      return apiError('Email and password are required', 400);
    }

    // 1. Try Admin (Principal) Table First
    const adminRows = await db.select({ id: principal.id, email: principal.email, password_hash: principal.password_hash })
      .from(principal)
      .where(eq(principal.email, email))
      .limit(1);

    if (adminRows.length > 0) {
      const admin = adminRows[0];
      const isValidPassword = await bcrypt.compare(password, admin.password_hash);

      if (isValidPassword) {
        const response = apiResponse({ success: true, message: 'Admin login successful', role: 'admin' });
        response.cookies.delete('clerk_auth');
        response.cookies.delete('student_auth');
        await issueAdminAuthCookie(response, admin, rememberMe);
        return response;
      }
      // If password doesn't match for an admin email, we don't fall through to clerks 
      // because emails should ideally be unique across system roles, 
      // but let's check clerks anyway just in case of shared emails (rare).
    }

    // 2. Try Clerks (Faculty/Staff) Table
    const clerkRows = await db.select().from(clerks).where(eq(clerks.email, email)).limit(1);

    if (clerkRows.length > 0) {
      const clerk = clerkRows[0];
      const passwordMatch = await bcrypt.compare(password, clerk.password_hash);

      if (passwordMatch) {
        if (!clerk.is_active) {
          return apiError('Your account has been deactivated. Please contact the administrator.', 403);
        }

        const response = apiResponse({ success: true, message: 'Login successful', role: clerk.role });
        response.cookies.delete('admin_auth');
        response.cookies.delete('student_auth');
        await issueClerkAuthCookie(response, clerk, rememberMe);
        return response;
      }
    }

    // 3. Fail
    logger.warn({ email }, '[Employee Login Failed] Invalid credentials');
    return apiError('Invalid credentials', 401);

  } catch (error) {
    logger.error(error, 'Employee Login error');
    return apiError('An internal server error occurred.', 500);
  }
}

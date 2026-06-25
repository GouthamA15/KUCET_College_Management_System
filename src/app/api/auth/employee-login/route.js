import { db } from '@/db';
import { clerks, principal } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { apiResponse, apiError } from '@/lib/api-utils';
import { checkRateLimit, getTieredKey } from '@/lib/rate-limit';
import { issueClerkAuthCookie, issueAdminAuthCookie } from '@/lib/auth-utils';
import logger from '@/lib/logger';
import { z } from 'zod';

export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'anonymous';
    const rateCheck = await checkRateLimit(getTieredKey(request, 'login_employee'), 5, 900); // 5 attempts per 15 min
    
    if (!rateCheck.success) {
      return apiError('Too many login attempts. Please try again later.', 429);
    }

    const json = await request.json();

    // --- ZERO TRUST VALIDATION ---
    const loginSchema = z.object({
      email: z.string().trim().min(1, "Email is required").toLowerCase(),
      password: z.string().min(1, "Password is required"),
      rememberMe: z.boolean().default(false)
    });

    const validatedData = loginSchema.parse(json);
    const { email, password, rememberMe } = validatedData;

    // 1. Try Admin (Principal) Table First
    const adminRows = await db.select({ id: principal.id, email: principal.email, password_hash: principal.password_hash })
      .from(principal)
      .where(eq(principal.email, email))
      .limit(1);

    if (adminRows.length > 0) {
      const admin = adminRows[0];
      const isValidPassword = await bcrypt.compare(password, admin.password_hash);

      if (isValidPassword) {
        // Log Security Event & Update Last Login
        const SecurityService = (await import('@/services/SecurityService')).default;
        await SecurityService.updateLastLogin('ADMIN', admin.id, ip);
        await SecurityService.logSecurityEvent({
          userType: 'ADMIN',
          userId: admin.id,
          eventType: 'LOGIN_SUCCESS',
          ipAddress: ip
        });

        const response = apiResponse({ success: true, message: 'Admin login successful', role: 'admin' });
        response.cookies.delete('clerk_auth');
        response.cookies.delete('student_auth');
        const userAgent = request.headers.get('user-agent') || 'Unknown';
        await issueAdminAuthCookie(response, admin, rememberMe, ip, userAgent);
        return response;
      }
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

        // Log Security Event & Update Last Login
        const SecurityService = (await import('@/services/SecurityService')).default;
        await SecurityService.updateLastLogin('CLERK', clerk.id, ip);
        await SecurityService.logSecurityEvent({
          userType: 'CLERK',
          userId: clerk.id,
          eventType: 'LOGIN_SUCCESS',
          ipAddress: ip
        });

        const response = apiResponse({ success: true, message: 'Login successful', role: clerk.role });
        response.cookies.delete('admin_auth');
        response.cookies.delete('student_auth');
        const userAgent = request.headers.get('user-agent') || 'Unknown';
        await issueClerkAuthCookie(response, clerk, rememberMe, ip, userAgent);
        return response;
      }
    }

    // 3. Fail
    logger.warn({ email }, '[Employee Login Failed] Invalid credentials');
    return apiError('Invalid credentials', 401);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.errors?.[0]?.message || 'Invalid input data', 400);
    }
    logger.error(error, 'Employee Login error');
    return apiError('An internal server error occurred.', 500);
  }
}

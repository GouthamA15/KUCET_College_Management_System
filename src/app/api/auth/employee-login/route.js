import { db } from '@/db';
import { staffAccounts, staffAccountRoles, staffRoles, staffAcademicAffiliations, academicDepartments, principal } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { apiResponse, apiError } from '@/lib/api-utils';
import { checkRateLimit, getTieredKey } from '@/lib/rate-limit';
import { issueStaffAuthCookie, issueAdminAuthCookie, deleteCookie } from '@/lib/auth-utils';
import logger from '@/lib/logger';
import { z } from 'zod';

export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'anonymous';
    const rateCheck = await checkRateLimit(getTieredKey(request, 'login_employee'), 5, 900);
    
    if (!rateCheck.success) {
      return apiError('Too many login attempts. Please try again later.', 429);
    }

    const json = await request.json();

    const loginSchema = z.object({
      email: z.string().trim().min(1, "Email is required").toLowerCase(),
      password: z.string().min(1, "Password is required"),
      rememberMe: z.boolean().default(false)
    });

    const validatedData = loginSchema.parse(json);
    const { email, password, rememberMe } = validatedData;

    const accountLock = await checkRateLimit(`login_employee_acct:${email}`, 8, 1800);
    if (!accountLock.success) {
      return apiError('Account temporarily locked due to too many failed attempts.', 429);
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
        const SecurityService = (await import('@/services/SecurityService')).default;
        await SecurityService.updateLastLogin('ADMIN', admin.id, ip);
        await SecurityService.logSecurityEvent({
          userType: 'ADMIN',
          userId: admin.id,
          eventType: 'LOGIN_SUCCESS',
          ipAddress: ip
        });

        const response = apiResponse({ success: true, message: 'Admin login successful', role: 'admin' });
        deleteCookie(response, 'staff_auth');
        deleteCookie(response, 'student_auth');
        const userAgent = request.headers.get('user-agent') || 'Unknown';
        await issueAdminAuthCookie(response, admin, rememberMe, ip, userAgent);
        return response;
      }
    }

    // 2. Try Staff Accounts Table
    const staffRows = await db.select({
      id: staffAccounts.id,
      name: staffAccounts.name,
      email: staffAccounts.email,
      employee_id: staffAccounts.employee_id,
      password_hash: staffAccounts.password_hash,
      staff_category: staffAccounts.staff_category,
      designation: staffAccounts.designation,
      pfp: staffAccounts.pfp,
      account_status: staffAccounts.account_status
    }).from(staffAccounts).where(eq(staffAccounts.email, email)).limit(1);

    if (staffRows.length > 0) {
      const staff = staffRows[0];
      const passwordMatch = await bcrypt.compare(password, staff.password_hash);

      if (passwordMatch) {
        if (staff.account_status !== 'ACTIVE') {
          return apiError('Your account is not active. Please contact the administrator.', 403);
        }

        // Fetch Role
        const roleRecords = await db.select({ role_code: staffRoles.role_code })
          .from(staffAccountRoles)
          .innerJoin(staffRoles, eq(staffAccountRoles.role_id, staffRoles.id))
          .where(eq(staffAccountRoles.staff_account_id, staff.id))
          .limit(1);
          
        let resolvedRole = 'faculty';
        if (roleRecords.length > 0) {
            const rCode = roleRecords[0].role_code;
            if (rCode?.includes('ADMISSION')) resolvedRole = 'admission';
            else if (rCode?.includes('SCHOLARSHIP')) resolvedRole = 'scholarship';
            else resolvedRole = 'faculty';
        }

        // Fetch HOD & Branch
        let isHod = false;
        let branch = null;
        if (resolvedRole === 'faculty') {
            const affil = await db.select({ branch_code: academicDepartments.department_code })
                .from(staffAcademicAffiliations)
                .innerJoin(academicDepartments, eq(staffAcademicAffiliations.department_id, academicDepartments.id))
                .where(eq(staffAcademicAffiliations.staff_account_id, staff.id))
                .limit(1);
            if (affil.length > 0) {
              branch = affil[0].branch_code;
            }

            const { facultyHodAssignments } = await import('@/db/schema');
            const hodRow = await db.select({ id: facultyHodAssignments.id })
                .from(facultyHodAssignments)
                .where(and(
                  eq(facultyHodAssignments.staff_account_id, staff.id),
                  eq(facultyHodAssignments.is_active, true)
                ))
                .limit(1);
            if (hodRow.length > 0) {
              isHod = true;
            }
        }

        const SecurityService = (await import('@/services/SecurityService')).default;
        await SecurityService.updateLastLogin('staff', staff.id, ip);
        await SecurityService.logSecurityEvent({
          userType: 'staff',
          userId: staff.id,
          eventType: 'LOGIN_SUCCESS',
          ipAddress: ip
        });

        const response = apiResponse({
          success: true,
          message: 'Login successful',
          role: resolvedRole,
          mustChangePassword: !!staff.must_change_password
        });
        deleteCookie(response, 'admin_auth');
        deleteCookie(response, 'student_auth');
        const userAgent = request.headers.get('user-agent') || 'Unknown';
        
        const adaptedStaff = {
           id: staff.id,
           email: staff.email,
           role: resolvedRole,
           is_hod: isHod,
           branch: branch
        };
        await issueStaffAuthCookie(response, adaptedStaff, rememberMe, ip, userAgent);
        return response;
      }
    }

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

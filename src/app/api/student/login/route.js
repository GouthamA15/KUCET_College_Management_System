import { db } from '@/db';
import { students, studentPersonalDetails } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiResponse, apiError, wrapHandler } from '@/lib/api-utils';
import bcrypt from 'bcrypt';
import { checkRateLimit, getTieredKey } from '@/lib/rate-limit';
import logger from '@/lib/logger';
import { z } from 'zod';
import crypto from 'crypto';

const loginSchema = z.object({
  rollno: z.string().trim().toUpperCase().min(10).max(12),
  dob: z.string().trim().max(255), // Can be DOB (8-10) or Password (up to 255)
  rememberMe: z.boolean().default(false)
});

// ─── FIX #7: Constant-time string comparison with 255-byte padded buffers ───
// Eliminates the timing oracle that allowed inferring DOB format character-by-character.
const COMPARE_PAD_LEN = 255;
function timingSafeStringEqual(a, b) {
  const aBuf = Buffer.alloc(COMPARE_PAD_LEN);
  const bBuf = Buffer.alloc(COMPARE_PAD_LEN);
  Buffer.from(String(a)).copy(aBuf, 0, 0, Math.min(String(a).length, COMPARE_PAD_LEN));
  Buffer.from(String(b)).copy(bBuf, 0, 0, Math.min(String(b).length, COMPARE_PAD_LEN));
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export const POST = wrapHandler({
  schema: loginSchema,
  handler: async (req, { data }) => {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'anonymous';

    // ─── IP-based rate limit (existing) ───
    const rateCheck = await checkRateLimit(getTieredKey(req, 'login_student'), 5, 900); // 5 attempts per 15 min
    if (!rateCheck.success) {
      return apiError('Too many login attempts. Please try again later.', 429);
    }

    const { rollno, dob, rememberMe } = data;

    // ─── FIX #8: Per-account lockout (8 attempts / 30 min per roll number) ───
    // Prevents distributed brute-force that bypasses the shared IP limit.
    const accountLock = await checkRateLimit(`login_student_acct:${rollno}`, 8, 1800); // 8 per 30 min
    if (!accountLock.success) {
      return apiError('Account temporarily locked due to too many failed attempts. Please try again in 30 minutes.', 429);
    }
    
    const rows = await db.select({
      id: students.id,
      roll_no: students.roll_no,
      name: students.name,
      is_email_verified: students.is_email_verified,
      father_name: studentPersonalDetails.father_name,
      category: studentPersonalDetails.category,
      mobile: students.mobile,
      date_of_birth: students.date_of_birth,
      password_hash: students.password_hash,
      academic_offset_years: students.academic_offset_years
    })
    .from(students)
    .leftJoin(studentPersonalDetails, eq(students.id, studentPersonalDetails.student_id))
    .where(eq(students.roll_no, rollno))
    .limit(1);

    if (rows.length === 0) {
      logger.warn({ rollno }, '[Student Login Failed] User not found');
      return apiError('Invalid credentials', 401);
    }

    const student = rows[0];
    let isAuthenticated = false;

    if (student.password_hash) {
      const match = await bcrypt.compare(dob, student.password_hash);
      if (match) isAuthenticated = true;
      else {
        logger.warn({ rollno }, '[Student Login Failed] Password mismatch');
        return apiError('Invalid credentials', 401);
      }
    } else {
      const dbDate = new Date(student.date_of_birth);
      const dbDateString = dbDate.getFullYear() + '-' + String(dbDate.getMonth() + 1).padStart(2, '0') + '-' + String(dbDate.getDate()).padStart(2, '0');
      
      let inputDateString = dob;
      if (dob.includes('-')) {
        const parts = dob.split('-');
        if (parts[0].length === 2 && parts[2].length === 4) {
           inputDateString = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }

      // ─── FIX #7: Use timingSafeStringEqual instead of plain === ───
      if (timingSafeStringEqual(dbDateString, inputDateString)) isAuthenticated = true;
      else {
        logger.warn({ rollno }, '[Student Login Failed] DOB mismatch');
        return apiError('Invalid credentials', 401);
      }
    }

    if (!isAuthenticated) return apiError('Authentication failed', 401);
    
    // Log Security Event & Update Last Login
    const SecurityService = (await import('@/services/SecurityService')).default;

    await SecurityService.updateLastLogin('STUDENT', student.id, ip);
    await SecurityService.logSecurityEvent({
      userType: 'STUDENT',
      userId: student.id,
      eventType: 'LOGIN_SUCCESS',
      ipAddress: ip
    });

    const { date_of_birth: _dob, password_hash: _ph, ...profile } = student;
    const response = apiResponse({ student: profile, success: true });

    response.cookies.delete('admin_auth');
    response.cookies.delete('staff_auth');

    const userAgent = req.headers.get('user-agent') || 'Unknown';
    const { issueStudentAuthCookie } = await import('@/lib/auth-utils');
    await issueStudentAuthCookie(response, student, rememberMe, ip, userAgent);

    return response;
  }
});

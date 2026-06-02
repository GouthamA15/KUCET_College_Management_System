import { db } from '@/db';
import { students, studentPersonalDetails } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiResponse, apiError } from '@/lib/api-utils';
import bcrypt from 'bcrypt';
import { checkRateLimit } from '@/lib/rate-limit';
import logger from '@/lib/logger';
import { z } from 'zod';

export async function POST(req) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'anonymous';
    const rateCheck = await checkRateLimit(`login_student:${ip}`, 5, 900); // 5 attempts per 15 min

    if (!rateCheck.success) {
      return apiError('Too many login attempts. Please try again later.', 429);
    }

    const json = await req.json();

    // --- ZERO TRUST VALIDATION ---
    const loginSchema = z.object({
      rollno: z.string().trim().toUpperCase().min(10).max(12),
      dob: z.string().trim().min(8).max(10), // Can be DD-MM-YYYY or YYYY-MM-DD
      rememberMe: z.boolean().default(false)
    });

    const validatedData = loginSchema.parse(json);
    const { rollno, dob, rememberMe } = validatedData;
    
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

      if (dbDateString === inputDateString) isAuthenticated = true;
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
    response.cookies.delete('clerk_auth');

    const userAgent = req.headers.get('user-agent') || 'Unknown';
    const { issueStudentAuthCookie } = await import('@/lib/auth-utils');
    await issueStudentAuthCookie(response, student, rememberMe, ip, userAgent);

    return response;

  } catch (err) {
    if (err instanceof z.ZodError) {
      return apiError(err.errors[0].message, 400);
    }
    logger.error(err, 'Student Login Error');
    return apiError('Server error', 500, err.message);
  }
}

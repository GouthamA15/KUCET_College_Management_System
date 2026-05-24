import { db } from '@/db';
import { students, studentPersonalDetails } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiResponse, apiError } from '@/lib/api-utils';
import bcrypt from 'bcrypt';
import { checkRateLimit } from '@/lib/rate-limit';
import logger from '@/lib/logger';

export async function POST(req) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'anonymous';
    const rateCheck = await checkRateLimit(`login_student:${ip}`, 5, 900); // 5 attempts per 15 min

    if (!rateCheck.success) {
      return apiError('Too many login attempts. Please try again later.', 429);
    }

    const body = await req.json();
    let { rollno, dob, rememberMe } = body;
    if (!rollno || !dob) {
      return apiError('Missing rollno or dob', 400);
    }

    // Invisible Normalization Hook
    rollno = String(rollno).trim().toUpperCase();
    
    const rows = await db.select({
      id: students.id,
      roll_no: students.roll_no,
      name: students.name,
      is_email_verified: students.is_email_verified,
      father_name: studentPersonalDetails.father_name,
      category: studentPersonalDetails.category,
      mobile: students.mobile,
      date_of_birth: students.date_of_birth,
      password_hash: students.password_hash
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
    
    const { date_of_birth: _dob, password_hash: _ph, ...profile } = student;
    const response = apiResponse({ student: profile, success: true });

    response.cookies.delete('admin_auth');
    response.cookies.delete('clerk_auth');

    const { issueStudentAuthCookie } = await import('@/lib/auth-utils');
    await issueStudentAuthCookie(response, student, rememberMe);

    return response;

  } catch (err) {
    logger.error(err, 'Student Login Error');
    return apiError('Server error', 500, err.message);
  }
}

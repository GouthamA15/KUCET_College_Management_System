import logger from '@/lib/logger';
import { StudentService } from '@/services/StudentService';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { studentCreateSchema } from '@/lib/validations/student';

export async function GET(req) {
  const user = await getAuthUser('clerk');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const year = req.nextUrl.searchParams.get('year');
    const branch = req.nextUrl.searchParams.get('branch');

    if (!year || !branch) {
      return apiError('Year and branch are required', 400);
    }

    const students = await StudentService.getStudentsByYearAndBranch(year, branch);
    return apiResponse({ students });
  } catch (error) {
    logger.error('Error fetching students:', error);
    return apiError('Failed to fetch students', 500, error.message);
  }
}

export async function POST(req) {
  const user = await getAuthUser('clerk');
  if (!user) return apiError('Unauthorized', 401);

  try {
    let rawData;
    try {
      rawData = await req.json();
    } catch (parseError) {
      if (parseError instanceof SyntaxError) {
        return apiError('Malformed JSON body', 400);
      }
      throw parseError;
    }
    
    // 1. Validate Input using Zod
    const validation = studentCreateSchema.safeParse(rawData);
    if (!validation.success) {
      return apiError(validation.error.errors[0].message, 400);
    }

    const clerkId = user.clerkId || user.id;
    if (!clerkId) {
      return apiError('Missing clerk ID in auth user', 400);
    }
    
    const studentId = await StudentService.createStudent(validation.data, clerkId);
    
    // Normalize client IP for audit logging
    let clientIp = req.ip || 'unknown';
    if (!clientIp || clientIp === 'unknown') {
      const xForwardedFor = req.headers.get('x-forwarded-for');
      if (xForwardedFor) {
        const ips = xForwardedFor.split(',').map(ip => ip.trim());
        const firstIp = ips[0];
        if (firstIp && firstIp.length > 0) {
          clientIp = firstIp;
        }
      }
    }
    
    // Audit log for student creation (excludes PII)
    const userAgent = req.headers.get('user-agent') || '';
    logger.info({
      action: 'student_created',
      clerkId,
      studentId,
      rollNo: validation.data.roll_no,
      clientIp,
      userAgent: userAgent.substring(0, 255)
    }, 'Student record created by clerk');
    
    return apiResponse({ message: 'Student added successfully', studentId }, 201);
  } catch (error) {
    logger.error('Error adding student:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return apiError('Roll number or Email already exists', 409);
    }
    
    return apiError('Failed to add student', 500);
  }
}

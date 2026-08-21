import logger from '@/lib/logger';
import { StudentService } from '@/services/StudentService';
import { apiError, apiResponse, wrapHandler } from '@/lib/api-utils';
import { studentCreateSchema } from '@/lib/validations/student';

export const GET = wrapHandler({
  auth: 'staff',
  handler: async (req) => {
    const year = req.nextUrl.searchParams.get('year');
    const branch = req.nextUrl.searchParams.get('branch');

    if (!year || !branch) {
      return apiError('Year and branch are required', 400);
    }

    const students = await StudentService.getStudentsByYearAndBranch(year, branch);
    return { students };
  }
});

export const POST = wrapHandler({
  auth: 'staff',
  schema: studentCreateSchema,
  handler: async (req, { data, user, ip, userAgent }) => {
    const staffId = user.staffId || user.id;
    if (!staffId) {
      return apiError('Missing staff ID in auth user', 400);
    }
    
    const studentId = await StudentService.createStudent(data, staffId);
    
    // Audit log for student creation (excludes PII)
    logger.info({
      action: 'student_created',
      staffId,
      studentId,
      rollNo: data.roll_no,
      clientIp: ip,
      userAgent: userAgent.substring(0, 255)
    }, 'Student record created by staff');
    
    return apiResponse({ message: 'Student added successfully', studentId }, 201);
  }
});

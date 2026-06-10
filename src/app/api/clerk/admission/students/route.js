import { apiError, apiResponse, wrapHandler } from '@/lib/api-utils';
import { StudentService } from '@/services/StudentService';
import { studentCreateSchema } from '@/lib/validations/student';

export const POST = wrapHandler({
  auth: 'clerk',
  schema: studentCreateSchema,
  handler: async (req, { data, user }) => {
    if (user.role !== 'admission') {
      return apiError('Forbidden: Only admission clerks can add students', 403);
    }

    const clerkId = user.clerkId || user.id;
    const studentId = await StudentService.upsertStudent(data, clerkId);

    return { 
      success: true, 
      studentId, 
      roll_no: data.roll_no, 
      message: 'Student admitted successfully.' 
    };
  }
});

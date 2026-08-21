import { apiError, _apiResponse, wrapHandler } from '@/lib/api-utils';
import { StudentService } from '@/services/StudentService';
import { studentCreateSchema } from '@/lib/validations/student';

export const POST = wrapHandler({
  auth: 'admission',
  schema: studentCreateSchema,
  handler: async (req, { data, user }) => {
    if (user.role !== 'admission' && user.role !== 'admin') {
      return apiError('Forbidden: Only admission staff can add students', 403);
    }

    const staffId = user.staffId || user.id;
    const studentId = await StudentService.upsertStudent(data, staffId);

    return { 
      success: true, 
      studentId, 
      roll_no: data.roll_no, 
      message: 'Student admitted successfully.' 
    };
  }
});

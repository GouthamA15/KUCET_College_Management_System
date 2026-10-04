import { apiError, _apiResponse, wrapHandler } from '@/lib/api-utils';
import { StudentService } from '@/services/StudentService';
import { studentCreateSchema } from '@/lib/validations/student';
import { getStorageProvider } from '@/lib/providers/storage/factory';
import { STORAGE_FOLDERS } from '@/lib/storage-config';

export const POST = wrapHandler({
  auth: 'admission',
  schema: studentCreateSchema,
  handler: async (req, { data, user }) => {
    if (user.role !== 'admission' && user.role !== 'admin') {
      return apiError('Forbidden: Only admission staff can add students', 403);
    }

    const storage = getStorageProvider();
    
    // Fix Phase 1: Upload Base64 to Storage instead of passing Base64 to DB
    if (data.pfp && data.pfp.startsWith('data:image')) {
      const pfpRes = await storage.upload(data.pfp, STORAGE_FOLDERS.ADMISSION_DRAFTS_PFP);
      data.pfp = typeof pfpRes === 'string' ? pfpRes : pfpRes?.path;
    }
    
    if (data.signature && data.signature.startsWith('data:image')) {
      const sigRes = await storage.upload(data.signature, STORAGE_FOLDERS.ADMISSION_DRAFTS_SIGNATURES);
      data.signature = typeof sigRes === 'string' ? sigRes : sigRes?.path;
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

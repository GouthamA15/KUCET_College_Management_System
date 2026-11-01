import logger from '@/lib/logger';
import { apiError, apiResponse, wrapHandler } from '@/lib/api-utils';
import { z } from 'zod';
import IdempotencyService from '@/services/IdempotencyService';
import { finalizeAdmissionDraft } from '@/services/admission/AdmissionDraftFinalizeService';

export const POST = wrapHandler({
  auth: 'admission',
  handler: async (req, { user, context }) => {
    if (user.role !== 'admission' && user.role !== 'admin') return apiError('Forbidden', 403);

    const idempotencyKey = req.headers.get('idempotency-key');
    let idempotencyStarted = false;

    try {
      const params = await context.params;
      const id = parseInt(params.id, 10);
      const json = await req.json();

      if (idempotencyKey) {
        const { isDuplicate, response, code } = await IdempotencyService.start(idempotencyKey);
        if (isDuplicate) return apiResponse(response, code || 201);
        idempotencyStarted = true;
      }

      // Validate with Zod
      const finalizeSchema = z.object({
        roll_no: z.string().trim().toUpperCase().min(10),
        admission_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal(''))
      });

      const validatedData = finalizeSchema.parse(json);
      const rollNo = validatedData.roll_no;
      const admissionDateInput = validatedData.admission_date;

      const result = await finalizeAdmissionDraft({
        draftId: id,
        rollNo,
        admissionDateInput,
        user
      });

      const responseData = { 
        success: true, 
        studentId: result.studentId, 
        rollNo: result.rollNo,
        message: result.message || 'Student successfully admitted and record created.' 
      };

      if (idempotencyStarted) {
        await IdempotencyService.complete(idempotencyKey, 201, responseData);
      }

      return responseData;

    } catch (error) {
      if (idempotencyStarted) await IdempotencyService.fail(idempotencyKey);
      
      if (error instanceof z.ZodError) return apiError(error.errors?.[0]?.message || 'Invalid input data', 400);
      if (error.message === 'INVALID_ROLL_NO') return apiError('Invalid roll number format', 400);
      if (error.message === 'DRAFT_NOT_FOUND') return apiError('Draft not found', 404);
      if (error.message === 'DRAFT_NOT_VERIFIED') return apiError('Only verified drafts can be finalized', 400);
      if (error.message === 'INVALID_AREA_STATUS') return apiError("Invalid area status. Must be 'Local' or 'Non-Local'.", 400);
      if (error.message === 'STUDENT_EXISTS') return apiError('A student with this Roll No or Email already exists.', 409);
      if (error.message === 'ROLL_BRANCH_MISMATCH') return apiError('Roll number branch does not match the draft branch.', 400);
      if (error.message === 'ROLL_TYPE_MISMATCH') return apiError('Roll number admission type does not match the draft entrance exam.', 400);
      if (error.message === 'UPSERT_FAILED') return apiError('Student record creation failed.', 500);
      
      logger.error(error, 'Finalization error');
      throw error; // Let wrapHandler handle standard 500
    }
  },
  audit: {
    action: 'FINALIZE_ADMISSION',
    getTargetId: (data, result) => result.studentId,
    getAfter: (data, _result) => ({ roll_no: data.roll_no })
  }
});

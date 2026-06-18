import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  studentAdmissionDrafts 
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiError, apiResponse, wrapHandler } from '@/lib/api-utils';
import { validateRollNo } from '@/lib/rollNumber';
import { getNow } from '@/lib/clock';
import { z } from 'zod';
import { decrypt } from '@/lib/encryption';

import IdempotencyService from '@/services/IdempotencyService';
import { StudentService } from '@/services/StudentService';

export const POST = wrapHandler({
  auth: 'clerk',
  handler: async (req, { user, context }) => {
    if (user.role !== 'admission') return apiError('Forbidden', 403);

    const idempotencyKey = req.headers.get('idempotency-key');
    let idempotencyStarted = false;

    try {
      const params = await context.params;
      const id = parseInt(params.id);
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

      const parsed = validateRollNo(rollNo);
      if (!parsed.isValid) return apiError('Invalid roll number format', 400);

      const result = await db.transaction(async (tx) => {
        // 1. Fetch the full draft data with lock
        const draftRows = await tx.select()
          .from(studentAdmissionDrafts)
          .where(eq(studentAdmissionDrafts.id, id))
          .for('update');

        if (draftRows.length === 0) throw new Error('DRAFT_NOT_FOUND');
        const draft = draftRows[0];
        if (draft.status !== 'PROCESSED') throw new Error('DRAFT_NOT_VERIFIED');

        // Enforce branch + admission type consistency with the draft
        if (String(parsed.branch).toUpperCase() !== String(draft.branch).toUpperCase()) throw new Error('ROLL_BRANCH_MISMATCH');
        const expectedType = String(draft.entrance_exam).toUpperCase() === 'TG ECET' ? 'Lateral' : 'Regular';
        if (String(parsed.admissionType) !== expectedType) throw new Error('ROLL_TYPE_MISMATCH');

        const { getPermanentAddressFromDetails, getContactAddressFromDetails } = require('@/lib/address-utils');

        // 2. Map draft fields to upsert data structure
        const studentData = {
          ...draft,
          roll_no: rollNo,
          date_of_birth: draft.dob,
          admission_date: admissionDateInput || draft.admission_date,
          mobile: decrypt(draft.student_mobile),
          guardian_mobile: draft.guardian_mobile ? decrypt(draft.guardian_mobile) : null,
          aadhaar_no: draft.aadhaar_no ? decrypt(draft.aadhaar_no) : null,
          permanent_address: getPermanentAddressFromDetails(draft),
          contact_address: getContactAddressFromDetails(draft),
          identification_marks: `${draft.identification_mark_1 || ''}\n${draft.identification_mark_2 || ''}`.trim(),
          qualifying_exam: draft.entrance_exam,
          inter_marks: draft.inter_diploma_marks,
          ranks: draft.exam_rank
        };

        // 3. Perform Upsert via Service
        const studentId = await StudentService.upsertStudent(studentData, user.clerkId || user.id, tx);
        if (!studentId) throw new Error('UPSERT_FAILED');

        // 4. Mark draft as FINALIZED and cleanup large strings
        await tx.update(studentAdmissionDrafts)
          .set({ 
            status: "FINALIZED",
            pfp: null,
            signature: null,
            updated_at: getNow()
          })
          .where(eq(studentAdmissionDrafts.id, id));

        return { studentId };
      });

      const responseData = { success: true, studentId: result.studentId, message: 'Student successfully admitted and record created.' };

      if (idempotencyStarted) {
        await IdempotencyService.complete(idempotencyKey, 201, responseData);
      }

      return responseData;

    } catch (error) {
      if (idempotencyStarted) await IdempotencyService.fail(idempotencyKey);
      
      if (error instanceof z.ZodError) return apiError(error.errors?.[0]?.message || 'Invalid input data', 400);
      if (error.message === 'DRAFT_NOT_FOUND') return apiError('Draft not found', 404);
      if (error.message === 'DRAFT_NOT_VERIFIED') return apiError('Only verified drafts can be finalized', 400);
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
    getAfter: (data, result) => ({ roll_no: data.roll_no })
  }
});

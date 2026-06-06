import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  students as studentsTable, 
  studentPersonalDetails, 
  studentAcademicBackground, 
  studentImages, 
  studentSignatures, 
  studentAdmissionDrafts 
} from '@/db/schema';
import { eq, or } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser, logAudit } from '@/lib/api-utils';
import { validateRollNo } from '@/lib/rollNumber';
import { getNow } from '@/lib/clock';
import { z } from 'zod';
import { encrypt, decrypt, hashForIndex } from '@/lib/encryption';

import IdempotencyService from '@/services/IdempotencyService';

export async function POST(req, context) {
  const user = await getAuthUser('clerk');
  if (!user || user.role !== 'admission') {
    return apiError('Forbidden', 403);
  }

  const idempotencyKey = req.headers.get('idempotency-key');
  let idempotencyStarted = false;

  try {
    const params = await context.params;
    const id = parseInt(params.id);
    const json = await req.json();

    if (idempotencyKey) {
      const { isDuplicate, response, code } = await IdempotencyService.start(idempotencyKey);
      if (isDuplicate) {
        return apiResponse(response, code || 201);
      }
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
    if (!parsed.isValid) {
      return apiError('Invalid roll number format', 400);
    }

    const result = await db.transaction(async (tx) => {
      // 1. Fetch the full draft data with lock
      const draftRows = await tx.select()
        .from(studentAdmissionDrafts)
        .where(eq(studentAdmissionDrafts.id, id))
        .for('update');

      if (draftRows.length === 0) {
        throw new Error('DRAFT_NOT_FOUND');
      }
      const draft = draftRows[0];
      if (draft.status !== 'PROCESSED') {
        throw new Error('DRAFT_NOT_VERIFIED');
      }

      // Enforce branch + admission type consistency with the draft
      if (String(parsed.branch).toUpperCase() !== String(draft.branch).toUpperCase()) {
        throw new Error('ROLL_BRANCH_MISMATCH');
      }
      const expectedType = String(draft.entrance_exam).toUpperCase() === 'TG ECET' ? 'Lateral' : 'Regular';
      if (String(parsed.admissionType) !== expectedType) {
        throw new Error('ROLL_TYPE_MISMATCH');
      }

      // 2. Check if roll_no or email already exists
      const existing = await tx.select({ id: studentsTable.id })
        .from(studentsTable)
        .where(or(
          eq(studentsTable.roll_no, rollNo),
          eq(studentsTable.email, draft.email)
        ))
        .limit(1);

      if (existing.length > 0) {
        throw new Error('STUDENT_EXISTS');
      }

      const now = getNow();

      // Decrypt sensitive fields from draft and re-encrypt for students
      // This ensures scheme/key consistency and provides a clear audit trail in the transaction
      const rawMobile = draft.student_mobile ? decrypt(draft.student_mobile) : null;
      const rawGuardianMobile = draft.guardian_mobile ? decrypt(draft.guardian_mobile) : null;
      const rawAadhaar = draft.aadhaar_no ? decrypt(draft.aadhaar_no) : null;

      // 3. Insert into students table
      const [studentResult] = await tx.insert(studentsTable).values({
        admission_no: null,
        roll_no: rollNo,
        name: draft.name,
        date_of_birth: draft.dob,
        gender: draft.gender,
        mobile: rawMobile ? encrypt(rawMobile) : null,
        mobile_hash: rawMobile ? hashForIndex(rawMobile) : null,
        email: draft.email,
        added_by_clerk_id: user.clerkId || user.id,
        fee_reimbursement: draft.fee_reimbursement === 'YES' ? 'YES' : 'NO',
        admission_date: admissionDateInput ? new Date(admissionDateInput) : (draft.admission_date ? new Date(draft.admission_date) : now),
        created_at: now
      });

      const studentId = studentResult.insertId;

      // 4. Insert into personal details
      await tx.insert(studentPersonalDetails).values({
        student_id: studentId,
        father_name: draft.father_name,
        mother_name: draft.mother_name,
        nationality: draft.nationality,
        religion: draft.religion,
        category: draft.category,
        sub_caste: draft.sub_caste,
        area_status: draft.area_status === 'Local' ? 'Local' : 'Non-Local',
        mother_tongue: draft.mother_tongue,
        place_of_birth: draft.place_of_birth,
        father_occupation: draft.father_occupation,
        annual_income: draft.annual_income,
        guardian_mobile: rawGuardianMobile ? encrypt(rawGuardianMobile) : null,
        aadhaar_no: rawAadhaar ? encrypt(rawAadhaar) : null,
        aadhaar_hash: rawAadhaar ? hashForIndex(rawAadhaar) : null,
        address: draft.permanent_address,
        identification_marks: `${draft.identification_mark_1 || ''}\n${draft.identification_mark_2 || ''}`.trim()
      });

      // 5. Insert into academic background
      await tx.insert(studentAcademicBackground).values({
        student_id: studentId,
        qualifying_exam: draft.entrance_exam,
        ssc_marks: draft.ssc_marks,
        inter_marks: draft.inter_diploma_marks,
        ranks: draft.exam_rank
      });

      // 6. Insert Images if they exist
      if (draft.pfp) {
        await tx.insert(studentImages).values({ student_id: studentId, pfp: draft.pfp });
      }
      if (draft.signature) {
        await tx.insert(studentSignatures).values({ student_id: studentId, signature: draft.signature });
      }

      // 7. Mark draft as FINALIZED
      // IMPROVEMENT: We could delete it, but marking as FINALIZED is safer for audit.
      // However, to prevent data bloat and orphaned images, we should at least clear the large image strings.
      await tx.update(studentAdmissionDrafts)
        .set({ 
          status: "FINALIZED",
          pfp: null,
          signature: null,
          updated_at: now
        })
        .where(eq(studentAdmissionDrafts.id, id));

      return { studentId };
    });

    // Audit Log
    await logAudit(req, {
      userId: user.clerkId || user.id,
      userType: 'clerk',
      action: 'FINALIZE_ADMISSION',
      targetId: result.studentId,
      targetType: 'student',
      payload_after: { draft_id: id, roll_no: rollNo }
    });

    const responseData = { success: true, studentId: result.studentId, message: 'Student successfully admitted and record created.' };

    if (idempotencyStarted) {
      await IdempotencyService.complete(idempotencyKey, 201, responseData);
    }

    return apiResponse(responseData, 201);

  } catch (error) {
    if (idempotencyStarted) await IdempotencyService.fail(idempotencyKey);
    if (error instanceof z.ZodError) {
      return apiError(error.errors?.[0]?.message || 'Invalid input data', 400);
    }
    if (error.message === 'DRAFT_NOT_FOUND') return apiError('Draft not found', 404);
    if (error.message === 'DRAFT_NOT_VERIFIED') return apiError('Only verified drafts can be finalized', 400);
    if (error.message === 'STUDENT_EXISTS') return apiError('A student with this Roll No or Email already exists.', 409);
    if (error.message === 'ROLL_BRANCH_MISMATCH') return apiError('Roll number branch does not match the draft branch.', 400);
    if (error.message === 'ROLL_TYPE_MISMATCH') return apiError('Roll number admission type does not match the draft entrance exam.', 400);
    
    logger.error(error, 'Finalization error');
    return apiError('Failed to finalize admission.', 500);
  }
}

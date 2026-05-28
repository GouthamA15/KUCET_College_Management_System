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

export async function POST(req, context) {
  const user = await getAuthUser('clerk');
  if (!user || user.role !== 'admission') {
    return apiError('Forbidden', 403);
  }

  try {
    const params = await context.params;
    const id = parseInt(params.id);
    const { roll_no, admission_date } = await req.json();
    const rollNo = String(roll_no || '').trim().toUpperCase();

    if (!rollNo) {
      return apiError('Roll number is required', 400);
    }

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
      const expectedType = String(draft.entrance_exam).toUpperCase() === 'ECET' ? 'Lateral' : 'Regular';
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

      // 3. Insert into students table
      const [studentResult] = await tx.insert(studentsTable).values({
        admission_no: null,
        roll_no: rollNo,
        name: draft.name,
        date_of_birth: draft.dob,
        gender: draft.gender,
        mobile: draft.student_mobile,
        mobile_hash: draft.mobile_hash, // Transfer blind index
        email: draft.email,
        added_by_clerk_id: user.clerkId || user.id,
        fee_reimbursement: draft.fee_reimbursement === 'YES' ? 'YES' : 'NO',
        admission_date: admission_date ? new Date(admission_date) : (draft.admission_date ? new Date(draft.admission_date) : new Date()),
        created_at: new Date()
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
        guardian_mobile: draft.guardian_mobile,
        aadhaar_no: draft.aadhaar_no,
        aadhaar_hash: draft.aadhaar_hash, // Transfer blind index
        address: draft.permanent_address,
        identification_marks: `${draft.identification_mark_1 || ''}\n${draft.identification_mark_2 || ''}`.trim()
      });

      // 5. Insert into academic background
      await tx.insert(studentAcademicBackground).values({
        student_id: studentId,
        qualifying_exam: draft.entrance_exam,
        ssc_marks: draft.ssc_marks,
        inter_marks: draft.inter_marks || draft.inter_diploma_marks,
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
      await tx.update(studentAdmissionDrafts)
        .set({ status: "FINALIZED" })
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

    return apiResponse({ success: true, studentId: result.studentId, message: 'Student successfully admitted and record created.' });

  } catch (error) {
    if (error.message === 'DRAFT_NOT_FOUND') return apiError('Draft not found', 404);
    if (error.message === 'DRAFT_NOT_VERIFIED') return apiError('Only verified drafts can be finalized', 400);
    if (error.message === 'STUDENT_EXISTS') return apiError('A student with this Roll No or Email already exists.', 409);
    if (error.message === 'ROLL_BRANCH_MISMATCH') return apiError('Roll number branch does not match the draft branch.', 400);
    if (error.message === 'ROLL_TYPE_MISMATCH') return apiError('Roll number admission type does not match the draft entrance exam.', 400);
    
    logger.error(error, 'Finalization error');
    return apiError('Failed to finalize admission.', 500);
  }
}

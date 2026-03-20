import { db } from '@/db';
import { 
  students as studentsTable, 
  studentPersonalDetails, 
  studentAcademicBackground, 
  studentImages, 
  studentSignatures, 
  studentAdmissionDrafts 
} from '@/db/schema';
import { eq, or, sql } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser, logAudit } from '@/lib/api-utils';

export async function POST(req, context) {
  const user = await getAuthUser('clerk');
  if (!user || user.role !== 'admission') {
    return apiError('Forbidden', 403);
  }

  try {
    const params = await context.params;
    const id = parseInt(params.id);
    const { roll_no } = await req.json();

    if (!roll_no) {
      return apiError('Roll number is required', 400);
    }

    const result = await db.transaction(async (tx) => {
      // 1. Fetch the full draft data with lock
      // Note: Drizzle doesn't have a direct 'FOR UPDATE' helper in query.findFirst yet, 
      // but we can use the standard select builder.
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

      // 2. Check if roll_no or email already exists
      const existing = await tx.select({ id: studentsTable.id })
        .from(studentsTable)
        .where(or(
          eq(studentsTable.roll_no, roll_no),
          eq(studentsTable.email, draft.email)
        ))
        .limit(1);

      if (existing.length > 0) {
        throw new Error('STUDENT_EXISTS');
      }

      // 3. Insert into students table
      const [studentResult] = await tx.insert(studentsTable).values({
        admission_no: null,
        roll_no: roll_no,
        name: draft.name,
        date_of_birth: draft.dob,
        gender: draft.gender,
        mobile: draft.student_mobile,
        email: draft.email,
        added_by_clerk_id: user.clerkId || user.id,
        fee_reimbursement: draft.fee_reimbursement === 'YES' ? 'YES' : 'NO',
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
      payload_after: { draft_id: id, roll_no: roll_no }
    });

    return apiResponse({ success: true, studentId: result.studentId, message: 'Student successfully admitted and record created.' });

  } catch (error) {
    if (error.message === 'DRAFT_NOT_FOUND') return apiError('Draft not found', 404);
    if (error.message === 'DRAFT_NOT_VERIFIED') return apiError('Only verified drafts can be finalized', 400);
    if (error.message === 'STUDENT_EXISTS') return apiError('A student with this Roll No or Email already exists.', 409);
    
    console.error('Finalization error:', error);
    return apiError('Failed to finalize admission.', 500);
  }
}

import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  studentAdmissionDrafts,
  students as studentsTable
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { validateRollNo } from '@/lib/rollNumber';
import { decrypt } from '@/lib/encryption';
import { getPermanentAddressFromDetails, getContactAddressFromDetails } from '@/lib/address-utils';
import { StudentService } from '@/services/StudentService';
import { sendInstitutionalEmail, getBaseUrl, EMAIL_CATEGORIES } from '@/lib/email';
import { broadcastUpdate } from '@/lib/sse';
import { AdmissionFinalizationService } from '@/services/AdmissionFinalizationService';

/**
 * Finalizes a single admission draft:
 * 1. Validates roll number format and consistency
 * 2. Runs DB transaction: locks draft, checks status, upserts student, marks draft FINALIZED
 * 3. Sends institutional portal activation email asynchronously
 * 4. Broadcasts SSE update and updates branch finalization status
 */
export async function finalizeAdmissionDraft({
  draftId,
  rollNo,
  admissionDateInput,
  user = {},
  tx = null
}) {
  const id = parseInt(draftId, 10);
  if (isNaN(id)) throw new Error('INVALID_DRAFT_ID');

  const normalizedRollNo = String(rollNo || '').trim().toUpperCase();
  const parsed = validateRollNo(normalizedRollNo);
  if (!parsed.isValid) throw new Error('INVALID_ROLL_NO');

  const runInTransaction = async (t) => {
    // 1. Fetch the full draft data with lock
    const draftRows = await t.select()
      .from(studentAdmissionDrafts)
      .where(eq(studentAdmissionDrafts.id, id))
      .for('update');

    if (draftRows.length === 0) throw new Error('DRAFT_NOT_FOUND');
    const draft = draftRows[0];
    if (draft.status !== 'PROCESSED') throw new Error('DRAFT_NOT_VERIFIED');

    // Enforce branch + admission type consistency with the draft
    if (String(parsed.branch).toUpperCase() !== String(draft.branch).toUpperCase()) {
      throw new Error('ROLL_BRANCH_MISMATCH');
    }
    const expectedType = String(draft.entrance_exam).toUpperCase() === 'TG ECET' ? 'Lateral' : 'Regular';
    if (String(parsed.admissionType) !== expectedType) {
      throw new Error('ROLL_TYPE_MISMATCH');
    }

    // 2. Proactively check if this roll number already exists
    const existingStudent = await t.select({ id: studentsTable.id })
      .from(studentsTable)
      .where(eq(studentsTable.roll_no, normalizedRollNo))
      .limit(1);

    if (existingStudent.length > 0) {
      throw new Error('STUDENT_EXISTS');
    }

    // 3. Map draft fields to upsert data structure
    const studentData = {
      ...draft,
      roll_no: normalizedRollNo,
      date_of_birth: draft.dob,
      admission_date: admissionDateInput || draft.admission_date,
      mobile: decrypt(draft.student_mobile),
      guardian_mobile: draft.guardian_mobile ? decrypt(draft.guardian_mobile) : null,
      aadhaar_no: draft.aadhaar_no ? decrypt(draft.aadhaar_no) : null,
      apaar_id: draft.apaar_id || null,
      permanent_address: getPermanentAddressFromDetails(draft),
      contact_address: getContactAddressFromDetails(draft),
      identification_marks: `${draft.identification_mark_1 || ''}\n${draft.identification_mark_2 || ''}`.trim(),
      qualifying_exam: draft.entrance_exam,
      inter_marks: draft.inter_diploma_marks,
      ranks: draft.exam_rank
    };

    // 4. Perform Upsert via Service
    const studentId = await StudentService.upsertStudent(studentData, user.staffId || user.id, t);
    if (!studentId) throw new Error('UPSERT_FAILED');

    // 5. Mark draft as FINALIZED and cleanup large strings
    await t.update(studentAdmissionDrafts)
      .set({ 
        status: "FINALIZED",
        pfp: null,
        signature: null,
        updated_at: new Date()
      })
      .where(eq(studentAdmissionDrafts.id, id));

    return { 
      studentId, 
      studentEmail: studentData.email, 
      studentName: studentData.name, 
      rollNo: normalizedRollNo,
      branch: draft.branch,
      entrance_exam: draft.entrance_exam,
      admission_year: draft.admission_year
    };
  };

  const result = tx ? await runInTransaction(tx) : await db.transaction(runInTransaction);

  // Send Welcome Email asynchronously
  if (result.studentEmail) {
    try {
      const emailHtml = `
        <p>Dear <strong>${result.studentName}</strong>,</p>
        <p>Congratulations! Your admission has been finalized and your KUCET student account is now institutionally active.</p>
        <p>Your official institutional roll number has been generated: <strong>${result.rollNo}</strong>.</p>
        <p>Your account is now ready for institutional use. You can log in and access the KUCET College Management System using your Date of Birth (YYYY-MM-DD) as the initial password.</p>
        <p>Please log in to the portal and set a new secure password to unlock full portal features.</p>
      `;

      sendInstitutionalEmail({
        to: result.studentEmail,
        subject: 'Welcome to KUCET! Your Account is Active',
        title: 'Account Activated',
        bodyHtml: emailHtml,
        action: {
          label: 'Login to Student Portal',
          url: `${getBaseUrl()}/student`,
          expiresIn: 'unlimited time. Please set your new password upon first login'
        },
        category: EMAIL_CATEGORIES.ADMISSIONS,
      }).catch(e => logger.error(e, 'Failed to send welcome email'));
    } catch (e) {
      logger.error(e, 'Failed to initialize welcome email');
    }
  }

  // SSE Broadcast (non-blocking)
  try {
    await broadcastUpdate('ADMISSION_DRAFT_FINALIZED', { 
      id, 
      studentId: result.studentId, 
      rollNo: result.rollNo,
      branch: result.branch,
      entrance_exam: result.entrance_exam,
      admission_year: result.admission_year
    });
  } catch (_e) {
    /* non-blocking */
  }

  // Branch finalization state check (non-blocking)
  try {
    await AdmissionFinalizationService.handleDraftFinalized({
      branch: result.branch,
      admissionYear: result.admission_year,
      updatedBy: user.email || 'admission_staff',
    });
  } catch (_finErr) {
    /* non-blocking */
  }

  return {
    success: true,
    studentId: result.studentId,
    rollNo: result.rollNo,
    studentName: result.studentName,
    studentEmail: result.studentEmail,
    branch: result.branch,
    message: 'Student successfully admitted and record created.'
  };
}

/**
 * Bulk finalizes multiple admission drafts sequentially/resiliently:
 * Iterates through items in order, executing finalization and recording individual results.
 */
export async function bulkFinalizeAdmissionDrafts({ items = [], user = {} }) {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      success: false,
      total: 0,
      successful: 0,
      failed: 0,
      results: []
    };
  }

  const results = [];
  let successful = 0;
  let failed = 0;

  for (const item of items) {
    const draftId = parseInt(item.draftId ?? item.id, 10);
    const rollNo = String(item.roll_no ?? item.rollNo ?? '').trim().toUpperCase();
    const admissionDateInput = item.admission_date ?? item.admissionDate ?? '';

    try {
      const res = await finalizeAdmissionDraft({
        draftId,
        rollNo,
        admissionDateInput,
        user
      });

      results.push({
        draftId,
        rollNo,
        studentId: res.studentId,
        studentName: res.studentName,
        studentEmail: res.studentEmail,
        success: true
      });
      successful++;
    } catch (error) {
      let friendlyError = error.message || 'Finalization failed';
      if (error.message === 'DRAFT_NOT_FOUND') friendlyError = 'Draft not found';
      else if (error.message === 'DRAFT_NOT_VERIFIED') friendlyError = 'Only verified drafts can be finalized';
      else if (error.message === 'STUDENT_EXISTS') friendlyError = 'A student with this Roll No or Email already exists.';
      else if (error.message === 'ROLL_BRANCH_MISMATCH') friendlyError = 'Roll number branch does not match draft branch.';
      else if (error.message === 'ROLL_TYPE_MISMATCH') friendlyError = 'Roll number admission type does not match entrance exam.';
      else if (error.message === 'INVALID_ROLL_NO') friendlyError = 'Invalid roll number format.';
      else if (error.message === 'UPSERT_FAILED') friendlyError = 'Student record creation failed.';

      results.push({
        draftId,
        rollNo,
        success: false,
        error: friendlyError
      });
      failed++;
    }
  }

  return {
    success: failed === 0,
    total: items.length,
    successful,
    failed,
    results
  };
}

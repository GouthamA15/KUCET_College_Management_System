import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  studentAttendance, 
  studentAttendanceDisputes, 
  attendanceDisputeAttachments,
  facultySubjectAssignments, 
  systemConfigs,
  staffAccounts
} from '@/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { STORAGE_FOLDERS } from '@/lib/storage-config';
import storage from '@/lib/storage';
import crypto from 'crypto';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_ATTACHMENTS = 5;

const VALID_CATEGORIES = new Set(['INCORRECT_MARKING', 'MEDICAL', 'AUTHORIZED_ACTIVITY', 'OTHER']);
const VALID_REQUESTED_STATUSES = new Set(['PRESENT', 'NCC', 'MEDICAL']);

export async function GET() {
  try {
    const user = await getAuthUser('student');
    if (!user || !user.student_id) {
      return apiError('Unauthorized', 401);
    }

    const disputes = await db.select({
      id: studentAttendanceDisputes.id,
      assignment_id: studentAttendanceDisputes.assignment_id,
      attendance_date: studentAttendanceDisputes.attendance_date,
      session: studentAttendanceDisputes.session,
      original_status: studentAttendanceDisputes.original_status,
      requested_status: studentAttendanceDisputes.requested_status,
      category: studentAttendanceDisputes.category,
      reason: studentAttendanceDisputes.reason,
      additional_explanation: studentAttendanceDisputes.additional_explanation,
      student_declaration: studentAttendanceDisputes.student_declaration,
      proof_url: studentAttendanceDisputes.proof_url,
      status: studentAttendanceDisputes.status,
      reviewed_by_staff_id: studentAttendanceDisputes.reviewed_by_staff_id,
      reviewed_at: studentAttendanceDisputes.reviewed_at,
      rejection_reason: studentAttendanceDisputes.rejection_reason,
      reviewer_comments: studentAttendanceDisputes.reviewer_comments,
      created_at: studentAttendanceDisputes.created_at,
      subject_name: facultySubjectAssignments.subject_name,
      subject_code: facultySubjectAssignments.subject_code,
      reviewer_name: staffAccounts.name
    })
    .from(studentAttendanceDisputes)
    .innerJoin(facultySubjectAssignments, eq(studentAttendanceDisputes.assignment_id, facultySubjectAssignments.id))
    .leftJoin(staffAccounts, eq(studentAttendanceDisputes.reviewed_by_staff_id, staffAccounts.id))
    .where(eq(studentAttendanceDisputes.student_id, user.student_id))
    .orderBy(desc(studentAttendanceDisputes.created_at));

    // Fetch attachments for these disputes
    const disputeIds = disputes.map(d => d.id);
    let attachmentsByDispute = {};

    if (disputeIds.length > 0) {
      const attachments = await db.select({
        id: attendanceDisputeAttachments.id,
        dispute_id: attendanceDisputeAttachments.dispute_id,
        file_name: attendanceDisputeAttachments.file_name,
        file_size: attendanceDisputeAttachments.file_size,
        mime_type: attendanceDisputeAttachments.mime_type,
        created_at: attendanceDisputeAttachments.created_at
      })
      .from(attendanceDisputeAttachments)
      .where(inArray(attendanceDisputeAttachments.dispute_id, disputeIds));

      for (const att of attachments) {
        if (!attachmentsByDispute[att.dispute_id]) {
          attachmentsByDispute[att.dispute_id] = [];
        }
        attachmentsByDispute[att.dispute_id].push({
          ...att,
          download_url: `/api/student/attendance/disputes/evidence/${att.id}`
        });
      }
    }

    const result = disputes.map(d => ({
      ...d,
      attachments: attachmentsByDispute[d.id] || []
    }));

    return apiResponse({ data: result });
  } catch (err) {
    logger.error('Error fetching student disputes:', err);
    return apiError('Internal Server Error', 500);
  }
}

export async function POST(request) {
  try {
    const user = await getAuthUser('student');
    if (!user || !user.student_id) {
      return apiError('Unauthorized', 401);
    }

    let assignment_id;
    let attendance_date;
    let session;
    let requested_status = 'PRESENT';
    let category = 'INCORRECT_MARKING';
    let reason = '';
    let additional_explanation = null;
    let student_declaration = false;
    let uploadedFiles = [];

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      assignment_id = Number(formData.get('assignment_id'));
      attendance_date = formData.get('attendance_date')?.toString().trim();
      session = Number(formData.get('session'));
      requested_status = formData.get('requested_status')?.toString().trim() || 'PRESENT';
      category = formData.get('category')?.toString().trim() || 'INCORRECT_MARKING';
      reason = formData.get('reason')?.toString().trim() || '';
      additional_explanation = formData.get('additional_explanation')?.toString().trim() || null;
      const declVal = formData.get('declaration') ?? formData.get('student_declaration');
      student_declaration = declVal === 'true' || declVal === true || declVal === '1';

      // Gather evidence files
      const evidenceEntries = formData.getAll('evidence');
      for (const entry of evidenceEntries) {
        if (entry && typeof entry === 'object' && entry.size > 0) {
          uploadedFiles.push(entry);
        }
      }
    } else {
      const body = await request.json();
      assignment_id = Number(body.assignment_id);
      attendance_date = body.attendance_date?.toString().trim();
      session = Number(body.session);
      requested_status = body.requested_status?.toString().trim() || 'PRESENT';
      category = body.category?.toString().trim() || 'INCORRECT_MARKING';
      reason = body.reason?.toString().trim() || '';
      additional_explanation = body.additional_explanation?.toString().trim() || null;
      student_declaration = !!body.declaration || !!body.student_declaration;
    }

    // 1. Validation
    if (!assignment_id || isNaN(assignment_id) || assignment_id <= 0) {
      return apiError('Valid assignment_id is required', 400);
    }
    if (!attendance_date || !/^\d{4}-\d{2}-\d{2}$/.test(attendance_date)) {
      return apiError('Valid attendance_date (YYYY-MM-DD) is required', 400);
    }
    if (!session || isNaN(session) || session < 1 || session > 8) {
      return apiError('Valid session number (1-8) is required', 400);
    }
    if (!VALID_REQUESTED_STATUSES.has(requested_status)) {
      return apiError(`Invalid requested_status. Allowed: ${Array.from(VALID_REQUESTED_STATUSES).join(', ')}`, 400);
    }
    if (!VALID_CATEGORIES.has(category)) {
      return apiError(`Invalid category. Allowed: ${Array.from(VALID_CATEGORIES).join(', ')}`, 400);
    }
    if (!reason || reason.length < 5) {
      return apiError('Please enter a clear explanation for the dispute (min 5 characters).', 400);
    }
    if (!student_declaration) {
      return apiError('You must confirm the declaration that the information and documents submitted are genuine.', 400);
    }

    // 2. Validate attendance record exists and status is ABSENT
    const [attRecord] = await db.select()
      .from(studentAttendance)
      .where(and(
        eq(studentAttendance.student_id, user.student_id),
        eq(studentAttendance.assignment_id, assignment_id),
        eq(studentAttendance.date, attendance_date),
        eq(studentAttendance.session, session)
      ))
      .limit(1);

    if (!attRecord) {
      return apiError('No attendance record found for this date and session.', 404);
    }

    if (attRecord.status !== 'ABSENT') {
      return apiError(`Only sessions marked as ABSENT can be disputed (current status: ${attRecord.status}).`, 400);
    }

    // 3. Verify dispute window from system_configs
    const windowRow = await db.query.systemConfigs.findFirst({
      where: eq(systemConfigs.config_key, 'ATTENDANCE_DISPUTE_WINDOW_DAYS')
    });
    const windowDays = windowRow ? Number(windowRow.config_value) : 7;

    const sessionTime = new Date(attendance_date + 'T00:00:00Z').getTime();
    const nowTime = Date.now();
    const diffDays = Math.floor((nowTime - sessionTime) / (1000 * 60 * 60 * 24));

    if (diffDays > windowDays) {
      return apiError(`Dispute window expired. Disputes must be submitted within ${windowDays} calendar days of the recorded absence.`, 400);
    }

    // 4. Check for existing pending or active dispute for this session
    const existing = await db.query.studentAttendanceDisputes.findFirst({
      where: and(
        eq(studentAttendanceDisputes.student_id, user.student_id),
        eq(studentAttendanceDisputes.assignment_id, assignment_id),
        eq(studentAttendanceDisputes.attendance_date, attendance_date),
        eq(studentAttendanceDisputes.session, session)
      )
    });

    if (existing && ['PENDING', 'MORE_INFO_REQUIRED', 'APPROVED'].includes(existing.status)) {
      return apiError(`A dispute is already ${existing.status.toLowerCase().replace('_', ' ')} for this session.`, 409);
    }

    // 5. Validate file attachments
    if (uploadedFiles.length > MAX_ATTACHMENTS) {
      return apiError(`Maximum ${MAX_ATTACHMENTS} evidence attachments allowed.`, 400);
    }

    for (const file of uploadedFiles) {
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        return apiError(`Invalid file format (${file.type || 'unknown'}). Allowed formats: JPEG, PNG, PDF.`, 400);
      }
      if (file.size > MAX_FILE_SIZE) {
        return apiError(`File "${file.name}" exceeds the maximum allowed size of 5 MB.`, 400);
      }
    }

    // 6. Upload evidence files securely with safe randomized object names
    const uploadedMetadata = [];
    for (const file of uploadedFiles) {
      const ext = file.name.split('.').pop()?.toLowerCase() || (file.type === 'application/pdf' ? 'pdf' : 'jpg');
      const safeFilename = `${crypto.randomUUID()}.${ext}`;
      
      const uploadRes = await storage.upload(file, STORAGE_FOLDERS.ATTENDANCE_EVIDENCE, safeFilename);
      const fileKey = typeof uploadRes === 'string' ? uploadRes : uploadRes?.path;

      if (!fileKey) {
        throw new Error('Failed to save evidence file to storage');
      }

      uploadedMetadata.push({
        file_key: fileKey,
        file_name: file.name.slice(0, 250),
        file_size: file.size,
        mime_type: file.type
      });
    }

    const primaryProofKey = uploadedMetadata[0]?.file_key || null;

    // 7. Atomic Insert / Resubmission
    let disputeId;

    if (existing && existing.status === 'REJECTED') {
      // Re-submit rejected dispute
      disputeId = existing.id;
      await db.update(studentAttendanceDisputes)
        .set({
          requested_status,
          category,
          reason,
          additional_explanation,
          student_declaration,
          proof_url: primaryProofKey,
          status: 'PENDING',
          reviewed_by_staff_id: null,
          reviewed_at: null,
          rejection_reason: null,
          reviewer_comments: null,
          updated_at: new Date()
        })
        .where(eq(studentAttendanceDisputes.id, disputeId));
    } else {
      const [result] = await db.insert(studentAttendanceDisputes).values({
        student_id: user.student_id,
        assignment_id,
        attendance_date,
        session,
        original_status: 'ABSENT',
        requested_status,
        category,
        reason,
        additional_explanation,
        student_declaration,
        proof_url: primaryProofKey,
        status: 'PENDING'
      });
      disputeId = result.insertId;
    }

    // Save attachment records
    for (const meta of uploadedMetadata) {
      await db.insert(attendanceDisputeAttachments).values({
        dispute_id: disputeId,
        student_id: user.student_id,
        file_key: meta.file_key,
        file_name: meta.file_name,
        file_size: meta.file_size,
        mime_type: meta.mime_type
      });
    }

    logger.info({
      disputeId,
      studentId: user.student_id,
      assignmentId: assignment_id,
      attendanceDate: attendance_date,
      session,
      category,
      attachmentsCount: uploadedMetadata.length
    }, '[ATTENDANCE_DISPUTE_SUBMITTED]');

    return apiResponse({
      success: true,
      dispute_id: disputeId,
      message: 'Attendance dispute submitted successfully with supporting evidence and queued for review.'
    }, 201);

  } catch (err) {
    logger.error('Error creating attendance dispute with evidence:', err);
    return apiError(err.message || 'Internal Server Error', 500);
  }
}

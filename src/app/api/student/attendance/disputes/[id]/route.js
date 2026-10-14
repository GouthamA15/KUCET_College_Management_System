import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  studentAttendanceDisputes, 
  attendanceDisputeAttachments
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { STORAGE_FOLDERS } from '@/lib/storage-config';
import storage from '@/lib/storage';
import crypto from 'crypto';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export async function PATCH(request, context) {
  try {
    const user = await getAuthUser('student');
    if (!user || !user.student_id) {
      return apiError('Unauthorized', 401);
    }

    const params = await context.params;
    const disputeId = parseInt(params.id, 10);
    if (!disputeId || isNaN(disputeId)) {
      return apiError('Valid dispute ID required', 400);
    }

    const [dispute] = await db.select()
      .from(studentAttendanceDisputes)
      .where(and(
        eq(studentAttendanceDisputes.id, disputeId),
        eq(studentAttendanceDisputes.student_id, user.student_id)
      ))
      .limit(1);

    if (!dispute) {
      return apiError('Dispute not found', 404);
    }

    if (dispute.status !== 'MORE_INFO_REQUIRED') {
      return apiError(`Cannot update dispute in '${dispute.status}' status. Only disputes requiring more information can be updated.`, 400);
    }

    let additional_explanation = '';
    let uploadedFiles = [];

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      additional_explanation = formData.get('additional_explanation')?.toString().trim() || '';
      const evidenceEntries = formData.getAll('evidence');
      for (const entry of evidenceEntries) {
        if (entry && typeof entry === 'object' && entry.size > 0) {
          uploadedFiles.push(entry);
        }
      }
    } else {
      const body = await request.json();
      additional_explanation = body.additional_explanation?.toString().trim() || '';
    }

    if (!additional_explanation || additional_explanation.length < 5) {
      return apiError('Please provide additional explanation (min 5 characters).', 400);
    }

    // Validate uploaded files
    for (const file of uploadedFiles) {
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        return apiError(`Invalid file format (${file.type}). Allowed: JPEG, PNG, PDF.`, 400);
      }
      if (file.size > MAX_FILE_SIZE) {
        return apiError(`File "${file.name}" exceeds 5 MB.`, 400);
      }
    }

    // Upload additional files
    const uploadedMetadata = [];
    for (const file of uploadedFiles) {
      const ext = file.name.split('.').pop()?.toLowerCase() || (file.type === 'application/pdf' ? 'pdf' : 'jpg');
      const safeFilename = `${crypto.randomUUID()}.${ext}`;
      const uploadRes = await storage.upload(file, STORAGE_FOLDERS.ATTENDANCE_EVIDENCE, safeFilename);
      const fileKey = typeof uploadRes === 'string' ? uploadRes : uploadRes?.path;

      if (fileKey) {
        uploadedMetadata.push({
          file_key: fileKey,
          file_name: file.name.slice(0, 250),
          file_size: file.size,
          mime_type: file.type
        });
      }
    }

    // Save attachments
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

    // Combine explanation and reset status to PENDING
    const updatedExplanation = dispute.additional_explanation 
      ? `${dispute.additional_explanation}\n---\n[Update ${new Date().toISOString().split('T')[0]}]: ${additional_explanation}`
      : additional_explanation;

    await db.update(studentAttendanceDisputes)
      .set({
        additional_explanation: updatedExplanation,
        status: 'PENDING',
        updated_at: new Date()
      })
      .where(eq(studentAttendanceDisputes.id, disputeId));

    logger.info({ disputeId, studentId: user.student_id }, '[ATTENDANCE_DISPUTE_RESUBMITTED_MORE_INFO]');

    return apiResponse({
      success: true,
      message: 'Additional information and evidence submitted. Dispute is now back in review.'
    });

  } catch (err) {
    logger.error('Error updating attendance dispute with more info:', err);
    return apiError(err.message || 'Internal Server Error', 500);
  }
}

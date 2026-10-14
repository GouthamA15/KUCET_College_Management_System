import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  studentAttendanceDisputes, 
  attendanceDisputeAttachments
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { STORAGE_FOLDERS } from '@/lib/storage-config';
import { storage } from '@/lib/providers';
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

    if (!['PENDING', 'MORE_INFO_REQUIRED'].includes(dispute.status)) {
      return apiError(`Cannot update dispute in '${dispute.status}' status. Only disputes that are pending or requiring more information can be updated.`, 400);
    }

    let additional_explanation = '';
    let uploadedFiles = [];

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      additional_explanation = formData.get('additional_explanation')?.toString().trim() || '';
      
      const candidateKeys = ['evidence', 'files', 'file', 'attachments', 'documents'];
      for (const key of candidateKeys) {
        const entries = formData.getAll(key);
        for (const entry of entries) {
          if (entry && typeof entry === 'object' && entry.size > 0 && !uploadedFiles.includes(entry)) {
            uploadedFiles.push(entry);
          }
        }
      }
      for (const [key, val] of formData.entries()) {
        if (val && typeof val === 'object' && typeof val.arrayBuffer === 'function' && val.size > 0 && !uploadedFiles.includes(val)) {
          uploadedFiles.push(val);
        }
      }
    } else {
      const body = await request.json();
      additional_explanation = body.additional_explanation?.toString().trim() || '';
      if (body.files && Array.isArray(body.files)) {
        uploadedFiles.push(...body.files);
      } else if (body.evidence && Array.isArray(body.evidence)) {
        uploadedFiles.push(...body.evidence);
      }
    }

    if (!additional_explanation && uploadedFiles.length === 0) {
      return apiError('Please provide additional explanation or attach evidence files.', 400);
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

    // Combine explanation and ensure proof_url is set if empty
    let updatedExplanation = dispute.additional_explanation;
    if (additional_explanation) {
      updatedExplanation = dispute.additional_explanation 
        ? `${dispute.additional_explanation}\n---\n[Update ${new Date().toISOString().split('T')[0]}]: ${additional_explanation}`
        : additional_explanation;
    }

    const updateFields = {
      additional_explanation: updatedExplanation,
      status: 'PENDING',
      updated_at: new Date()
    };

    if (!dispute.proof_url && uploadedMetadata.length > 0) {
      updateFields.proof_url = uploadedMetadata[0].file_key;
    }

    await db.update(studentAttendanceDisputes)
      .set(updateFields)
      .where(eq(studentAttendanceDisputes.id, disputeId));

    logger.info({ disputeId, studentId: user.student_id, newAttachmentsCount: uploadedMetadata.length }, '[ATTENDANCE_DISPUTE_UPDATED_WITH_EVIDENCE]');

    return apiResponse({
      success: true,
      message: 'Additional information and evidence submitted successfully. Dispute is queued for review.'
    });

  } catch (err) {
    logger.error('Error updating attendance dispute with more info:', err);
    return apiError(err.message || 'Internal Server Error', 500);
  }
}

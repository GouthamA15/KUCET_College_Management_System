import logger from '@/lib/logger';
import { db } from '@/db';
import { studentAdmissionDrafts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiError, wrapHandler } from '@/lib/api-utils';
import { toMySQLDate } from '@/lib/date';
import { storage } from '@/lib/providers';
import { sendInstitutionalEmail } from '@/lib/email';
import { encrypt, decrypt } from '@/lib/encryption';

export const GET = wrapHandler({
  auth: 'admission',
  handler: async (req, { user, context }) => {
    if (user.role !== 'admission' && user.role !== 'admin') return apiError('Forbidden', 403);

    const params = await context.params;
    const id = parseInt(params.id);

    const draft = await db.query.studentAdmissionDrafts.findFirst({
      where: eq(studentAdmissionDrafts.id, id)
    });

    if (!draft) return apiError('Draft not found', 404);

    // Decrypt sensitive fields for display
    draft.student_mobile = decrypt(draft.student_mobile);
    draft.guardian_mobile = decrypt(draft.guardian_mobile);
    draft.aadhaar_no = decrypt(draft.aadhaar_no);

    const imageHelper = (val) => {
      if (!val) return null;
      if (typeof val === 'string' && (val.startsWith('http') || val.startsWith('data:') || val.startsWith('/api/'))) return val;
      if (typeof val === 'string') {
        return storage.getUrl(val);
      }
      if (Buffer.isBuffer(val)) return `data:image/png;base64,${val.toString('base64')}`;
      return val;
    };

    if (draft.pfp) draft.pfp = imageHelper(draft.pfp);
    if (draft.signature) draft.signature = imageHelper(draft.signature);

    // Ensure HTML <input type="date"> can display this (expects YYYY-MM-DD)
    if (draft.dob) draft.dob = toMySQLDate(draft.dob);

    // Fetch complete status history
    const { admissionStatusHistory, staffAccounts } = await import('@/db/schema');
    const { desc } = await import('drizzle-orm');
    const history = await db.select({
      id: admissionStatusHistory.id,
      old_status: admissionStatusHistory.old_status,
      new_status: admissionStatusHistory.new_status,
      reason: admissionStatusHistory.reason,
      changed_by_user_id: admissionStatusHistory.changed_by_user_id,
      changed_by_user_type: admissionStatusHistory.changed_by_user_type,
      staff_name: staffAccounts.name,
      metadata: admissionStatusHistory.metadata,
      created_at: admissionStatusHistory.created_at
    })
    .from(admissionStatusHistory)
    .leftJoin(staffAccounts, eq(admissionStatusHistory.changed_by_user_id, staffAccounts.id))
    .where(eq(admissionStatusHistory.draft_id, id))
    .orderBy(desc(admissionStatusHistory.created_at));

    draft.status_history = history;
    
    return { data: draft };
  }
});

export const PUT = wrapHandler({
  auth: 'admission',
  handler: async (req, { user, context }) => {
    if (user.role !== 'admission' && user.role !== 'admin') return apiError('Forbidden', 403);
  
    const params = await context.params;
    const id = parseInt(params.id);
    const body = await req.json();

    const currentDraft = await db.query.studentAdmissionDrafts.findFirst({
      where: eq(studentAdmissionDrafts.id, id)
    });
    if (!currentDraft) return apiError('Draft not found', 404);

    // Handle simple status update including rejection
    if (body.status && Object.keys(body).length <= 4) {
        if (!['DRAFT', 'PROCESSED', 'FINALIZED', 'REJECTED'].includes(body.status)) {
            return apiError('Invalid status', 400);
        }

        const staffId = user.staffId || user.id || null;

        if (body.status === 'REJECTED') {
          const reason = body.rejection_reason?.trim() || 'Information provided was incomplete or inconsistent with documents.';
          
          await db.transaction(async (tx) => {
            // 1. Soft update status to REJECTED with rejection metadata
            const { admissionStatusHistory, auditLogs } = await import('@/db/schema');
            await tx.update(studentAdmissionDrafts)
              .set({ 
                status: 'REJECTED',
                rejection_reason: reason,
                rejected_by_staff_id: staffId,
                rejected_at: new Date(),
                updated_at: new Date()
              })
              .where(eq(studentAdmissionDrafts.id, id));

            // 2. Record immutable status transition history
            await tx.insert(admissionStatusHistory).values({
              draft_id: id,
              old_status: currentDraft.status,
              new_status: 'REJECTED',
              reason: reason,
              changed_by_user_id: staffId,
              changed_by_user_type: user.role === 'admin' ? 'admin' : 'staff',
              metadata: {
                name: currentDraft.name,
                branch: currentDraft.branch,
                entrance_exam: currentDraft.entrance_exam,
                admission_year: currentDraft.admission_year,
                email: currentDraft.email
              }
            });

            // 3. Record audit event
            await tx.insert(auditLogs).values({
              user_id: staffId,
              user_type: user.role === 'admin' ? 'admin' : 'staff',
              action: 'REJECT_ADMISSION_DRAFT',
              target_id: String(id),
              target_type: 'admission_draft',
              payload_before: { status: currentDraft.status, name: currentDraft.name, email: currentDraft.email },
              payload_after: { status: 'REJECTED', rejection_reason: reason, rejected_by_staff_id: staffId },
              ip_address: req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1',
              user_agent: req.headers.get('user-agent') || 'system'
            });
          });

          // 4. Send institutional email asynchronously (do NOT delete documents or media)
          if (currentDraft.email) {
            sendInstitutionalEmail({
              to: currentDraft.email,
              subject: 'Admission Application Update - KUCET',
              title: 'Application Rejection',
              bodyHtml: `<p>Dear ${currentDraft.name},</p><p>We regret to inform you that your admission application to KUCET has been rejected for the following reason:</p><div style="background:#fff5f5; border-left:4px solid #f56565; padding:12px; margin:16px 0;"><strong>Reason:</strong> ${reason}</div><p>You may submit a fresh application or contact the admission cell if you believe this was in error.</p>`,
              infoRows: [
                { label: 'Application ID', value: id },
                { label: 'Status', value: 'REJECTED' }
              ]
            }).catch(e => logger.error(e, 'Failed to send rejection email'));
          }

          try {
            const { broadcastUpdate } = await import('@/lib/sse');
            await broadcastUpdate('ADMISSION_DRAFT_UPDATED', { 
              id, 
              status: 'REJECTED',
              branch: currentDraft.branch, 
              entrance_exam: currentDraft.entrance_exam, 
              admission_year: currentDraft.admission_year
            });
          } catch (_e) {
            /* non-blocking */
          }

          return { success: true, message: 'Application rejected, student notified, and record preserved in rejected queue.' };
        }

        // Status transition (e.g., DRAFT -> PROCESSED)
        await db.transaction(async (tx) => {
          const { admissionStatusHistory, auditLogs } = await import('@/db/schema');
          await tx.update(studentAdmissionDrafts)
            .set({ status: body.status, updated_at: new Date() })
            .where(eq(studentAdmissionDrafts.id, id));

          if (currentDraft.status !== body.status) {
            await tx.insert(admissionStatusHistory).values({
              draft_id: id,
              old_status: currentDraft.status,
              new_status: body.status,
              reason: body.reason || `Status updated to ${body.status}`,
              changed_by_user_id: staffId,
              changed_by_user_type: user.role === 'admin' ? 'admin' : 'staff',
              metadata: {
                name: currentDraft.name,
                branch: currentDraft.branch
              }
            });

            await tx.insert(auditLogs).values({
              user_id: staffId,
              user_type: user.role === 'admin' ? 'admin' : 'staff',
              action: `UPDATE_ADMISSION_DRAFT_STATUS`,
              target_id: String(id),
              target_type: 'admission_draft',
              payload_before: { status: currentDraft.status },
              payload_after: { status: body.status },
              ip_address: req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1',
              user_agent: req.headers.get('user-agent') || 'system'
            });
          }
        });

        try {
          const { broadcastUpdate } = await import('@/lib/sse');
          await broadcastUpdate('ADMISSION_DRAFT_UPDATED', { 
            id, 
            status: body.status,
            branch: currentDraft.branch, 
            entrance_exam: currentDraft.entrance_exam, 
            admission_year: currentDraft.admission_year
          });
        } catch (_e) {
          /* non-blocking */
        }

        return { success: true, message: `Status updated to ${body.status}` };
    }

    // Handle full update
    const { STORAGE_FOLDERS } = await import('@/lib/storage-config');
    if (body.pfp && body.pfp.startsWith('data:image')) {
      if (currentDraft?.pfp) await storage.delete(currentDraft.pfp);
      const res = await storage.upload(body.pfp, STORAGE_FOLDERS.ADMISSION_DRAFTS_PFP);
      body.pfp = typeof res === 'string' ? res : res?.path;
    }
    if (body.signature && body.signature.startsWith('data:image')) {
      if (currentDraft?.signature) await storage.delete(currentDraft.signature);
      const res = await storage.upload(body.signature, STORAGE_FOLDERS.ADMISSION_DRAFTS_SIGNATURES);
      body.signature = typeof res === 'string' ? res : res?.path;
    }

    const allowedFields = [
      'name', 'father_name', 'mother_name', 'dob', 'gender', 'email', 'student_mobile', 'guardian_mobile',
      'exam_rank', 'area_status', 'category', 'sub_caste', 'seat_allotted_category', 'ssc_marks', 'inter_diploma_marks',
      'nationality', 'religion', 'mother_tongue', 'blood_group', 'place_of_birth', 'father_occupation', 'annual_income', 
      'aadhaar_no', 'fee_reimbursement', 'identification_mark_1', 'identification_mark_2', 'permanent_address', 'branch', 'entrance_exam',
      'pfp', 'signature', 'status'
    ];

    const updateObj = {};
    for (const field of allowedFields) {
        if (body[field] !== undefined) {
            let value = body[field] === '' ? null : body[field];
            
            if (field === 'dob') {
                value = toMySQLDate(body[field]);
            } 
            else if (field === 'inter_diploma_marks' && value !== null) {
                const num = parseFloat(value);
                if (isNaN(num) || num < 0 || num > 1000) {
                    return apiError('Intermediate/Diploma marks must be between 0 and 1000.', 400);
                }
            }
            // Encrypt sensitive fields before saving
            else if (value && (field === 'student_mobile' || field === 'guardian_mobile' || field === 'aadhaar_no')) {
                value = encrypt(value);
            }

            updateObj[field] = value;
        }
    }

    if (Object.keys(updateObj).length === 0) return apiError('No valid fields', 400);

    await db.update(studentAdmissionDrafts)
      .set(updateObj)
      .where(eq(studentAdmissionDrafts.id, id));

    try {
      const { broadcastUpdate } = await import('@/lib/sse');
      await broadcastUpdate('ADMISSION_DRAFT_UPDATED', { 
        id, 
        branch: updateObj.branch || currentDraft.branch,
        entrance_exam: updateObj.entrance_exam || currentDraft.entrance_exam,
        admission_year: currentDraft.admission_year,
        status: updateObj.status || currentDraft.status,
      });
    } catch (_e) {
      /* non-blocking */
    }

    return { success: true, message: 'Draft updated successfully' };
  }
});

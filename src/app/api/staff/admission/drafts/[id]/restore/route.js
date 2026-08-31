import logger from '@/lib/logger';
import { db } from '@/db';
import { studentAdmissionDrafts, admissionStatusHistory, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiError, apiResponse, wrapHandler } from '@/lib/api-utils';
import { z } from 'zod';

const restoreSchema = z.object({
  target_status: z.enum(['DRAFT', 'PROCESSED']).default('DRAFT'),
  restoration_reason: z.string().trim().min(3, 'Restoration reason must be at least 3 characters').max(1000)
});

export const POST = wrapHandler({
  auth: 'admission',
  handler: async (req, { user, context }) => {
    if (user.role !== 'admission' && user.role !== 'admin') return apiError('Forbidden', 403);

    const params = await context.params;
    const id = parseInt(params.id);
    if (isNaN(id)) return apiError('Invalid draft ID', 400);

    const json = await req.json().catch(() => ({}));
    const parsed = restoreSchema.safeParse(json);
    if (!parsed.success) {
      return apiError(parsed.error.errors[0]?.message || 'Invalid input', 400);
    }

    const { target_status, restoration_reason } = parsed.data;
    const staffId = user.staffId || user.id || null;

    try {
      const currentDraft = await db.query.studentAdmissionDrafts.findFirst({
        where: eq(studentAdmissionDrafts.id, id)
      });

      if (!currentDraft) return apiError('Draft not found', 404);
      if (currentDraft.status !== 'REJECTED') {
        return apiError(`Cannot restore draft in status '${currentDraft.status}'. Only REJECTED drafts can be restored.`, 400);
      }

      await db.transaction(async (tx) => {
        // 1. Restore status and record restoration metadata
        await tx.update(studentAdmissionDrafts)
          .set({
            status: target_status,
            restored_by_staff_id: staffId,
            restored_at: new Date(),
            restoration_reason: restoration_reason,
            updated_at: new Date()
          })
          .where(eq(studentAdmissionDrafts.id, id));

        // 2. Insert immutable history event
        await tx.insert(admissionStatusHistory).values({
          draft_id: id,
          old_status: 'REJECTED',
          new_status: target_status,
          reason: restoration_reason,
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
          action: 'RESTORE_ADMISSION_DRAFT',
          target_id: String(id),
          target_type: 'admission_draft',
          payload_before: { status: 'REJECTED', rejection_reason: currentDraft.rejection_reason },
          payload_after: { status: target_status, restoration_reason, restored_by_staff_id: staffId },
          ip_address: req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1',
          user_agent: req.headers.get('user-agent') || 'system'
        });
      });

      // Realtime Notification
      try {
        const { broadcastUpdate } = await import('@/lib/sse');
        await broadcastUpdate('ADMISSION_DRAFT_UPDATED', {
          id,
          status: target_status,
          branch: currentDraft.branch,
          entrance_exam: currentDraft.entrance_exam,
          admission_year: currentDraft.admission_year,
          action: 'RESTORED'
        });
      } catch (_e) {
        /* non-blocking */
      }

      return apiResponse({
        success: true,
        message: `Application restored to ${target_status} status successfully.`,
        data: { id, status: target_status }
      });

    } catch (error) {
      logger.error(error, 'Error restoring rejected admission draft');
      return apiError('Failed to restore application', 500);
    }
  }
});

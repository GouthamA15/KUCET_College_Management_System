import { db } from '@/db';
import { staffRegistrationRequests, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { wrapHandler } from '@/lib/api-utils';
import { z } from 'zod';

const rejectSchema = z.object({
  rejectionReason: z.string().min(5, 'Rejection reason must be at least 5 characters')
});

export const POST = wrapHandler({
  auth: 'admin',
  schema: rejectSchema,
  handler: async (req, { data, user, context }) => {
    const idUrl = req.nextUrl.pathname.split('/');
    const idStr = idUrl[idUrl.length - 2];
    const requestId = parseInt(idStr, 10);

    if (isNaN(requestId)) {
      return { error: 'Invalid request ID', status: 400 };
    }

    const adminId = user?.id || user?.adminId;

    await db.transaction(async (tx) => {
      const [request] = await tx
        .select()
        .from(staffRegistrationRequests)
        .where(eq(staffRegistrationRequests.id, requestId))
        .for('update');

      if (!request) {
        throw new Error('Registration request not found');
      }

      if (request.status !== 'PENDING') {
        throw new Error(`Request has already been processed (Current status: ${request.status})`);
      }

      await tx.update(staffRegistrationRequests)
        .set({
          status: 'REJECTED',
          rejection_reason: data.rejectionReason,
          processed_at: new Date(),
          processed_by_admin_id: adminId
        })
        .where(eq(staffRegistrationRequests.id, requestId));

      await tx.insert(auditLogs).values({
        user_id: adminId.toString(),
        user_type: 'admin',
        action: 'STAFF_REGISTRATION_REJECTED',
        entity_type: 'staff_registration_requests',
        entity_id: requestId.toString(),
        metadata: { reason: data.rejectionReason },
        ip_address: context?.ip || '127.0.0.1'
      });
    });

    // Realtime Broadcast
    try {
      const { broadcastUpdate } = await import('@/lib/sse');
      await broadcastUpdate('STAFF_REGISTRATION_REJECTED', {
        id: requestId,
        status: 'REJECTED',
        rejection_reason: data.rejectionReason,
        processed_at: new Date().toISOString()
      });
    } catch (_e) {
      // Non-blocking
    }

    return { success: true, message: 'Request rejected' };
  }
});

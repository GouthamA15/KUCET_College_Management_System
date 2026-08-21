import logger from '@/lib/logger';
import { db } from '@/db';
import { studentFeePayments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser, logAudit } from '@/lib/api-utils';

export async function DELETE(req, ctx) {
  const user = await getAuthUser('scholarship');
  if (!user || (user.role !== 'scholarship' && user.role !== 'admin')) return apiError('Unauthorized', 401);

  try {
    const params = await ctx.params;
    const id = Number(params?.id);
    if (!id || !Number.isInteger(id) || id <= 0) return apiError('Invalid id', 400);

    // Fetch before delete for audit
    const existing = await db.query.studentFeePayments.findFirst({
      where: eq(studentFeePayments.id, id)
    });

    if (existing) {
      await db.delete(studentFeePayments).where(eq(studentFeePayments.id, id));
      
      await logAudit(req, {
        userId: user.staffId || user.id,
        userType: 'STAFF',
        action: 'DELETE_FEE_PAYMENT',
        targetId: id,
        targetType: 'finance',
        payload_before: existing
      });
    }
    
    return apiResponse({ success: true });
  } catch (error) {
    logger.error('Error deleting payment:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function GET() { return apiError('Method Not Allowed', 405); }
export async function POST() { return apiError('Method Not Allowed', 405); }
export async function PUT() { return apiError('Method Not Allowed', 405); }

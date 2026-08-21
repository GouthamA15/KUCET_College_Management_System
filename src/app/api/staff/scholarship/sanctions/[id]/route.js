import logger from '@/lib/logger';
import { db } from '@/db';
import { scholarshipSanctions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser, logAudit } from '@/lib/api-utils';

export async function DELETE(req, ctx) {
  const user = await getAuthUser('scholarship');
  // Security Hardening: Ensure only scholarship staff or admin can delete records
  if (!user || (user.role !== 'scholarship' && user.role !== 'admin')) return apiError('Forbidden', 403);

  try {
    const params = await ctx.params;
    const id = Number(params?.id);
    if (!id || !Number.isInteger(id) || id <= 0) return apiError('Invalid id', 400);

    // Fetch before delete for audit
    const existing = await db.query.scholarshipSanctions.findFirst({
      where: eq(scholarshipSanctions.id, id)
    });

    if (existing) {
      await db.delete(scholarshipSanctions).where(eq(scholarshipSanctions.id, id));
      
      await logAudit(req, {
        userId: user.staffId || user.id,
        userType: 'STAFF',
        action: 'DELETE_SCHOLARSHIP_SANCTION',
        targetId: id,
        targetType: 'scholarship',
        payload_before: existing
      });
    }
    
    return apiResponse({ success: true });
  } catch (error) {
    logger.error('Error deleting sanction:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function GET() { return apiError('Method Not Allowed', 405); }
export async function POST() { return apiError('Method Not Allowed', 405); }
export async function PUT() { return apiError('Method Not Allowed', 405); }

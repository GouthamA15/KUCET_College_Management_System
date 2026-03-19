import { db } from '@/db';
import { studentFeePayments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function DELETE(req, ctx) {
  const user = await getAuthUser('clerk');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const params = await ctx.params;
    const id = Number(params?.id);
    if (!id || !Number.isInteger(id) || id <= 0) return apiError('Invalid id', 400);

    await db.delete(studentFeePayments).where(eq(studentFeePayments.id, id));
    
    return apiResponse({ success: true });
  } catch (error) {
    console.error('Error deleting payment:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function GET() { return apiError('Method Not Allowed', 405); }
export async function POST() { return apiError('Method Not Allowed', 405); }
export async function PUT() { return apiError('Method Not Allowed', 405); }

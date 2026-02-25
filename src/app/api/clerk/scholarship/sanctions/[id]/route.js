import { query } from '@/lib/db';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function DELETE(req, ctx) {
  const user = await getAuthUser('clerk');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const params = ctx?.params ? (typeof ctx.params.then === 'function' ? await ctx.params : ctx.params) : {};
    const idRaw = params?.id;
    const id = Number(idRaw);
    if (!id || !Number.isInteger(id) || id <= 0) return apiError('Invalid id', 400);

    const delSql = 'DELETE FROM scholarship_sanctions WHERE id = ?';
    await query(delSql, [id]);
    return apiResponse({ success: true });
  } catch (error) {
    console.error('Error deleting sanction:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function GET() { return apiError('Method Not Allowed', 405); }
export async function POST() { return apiError('Method Not Allowed', 405); }
export async function PUT() { return apiError('Method Not Allowed', 405); }
import logger from '@/lib/logger';
import { db } from '@/db';
import { principal } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import bcrypt from 'bcrypt';

export async function POST(req) {
  try {
    const user = await getAuthUser('admin');

    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { oldPassword, newPassword } = await req.json();

    const admin = await db.query.principal.findFirst({
      where: eq(principal.email, user.email),
      columns: {
        password_hash: true
      }
    });

    if (!admin) {
      return apiError('Admin not found', 404);
    }

    const match = await bcrypt.compare(oldPassword, admin.password_hash);

    if (!match) {
      return apiError('Invalid old password', 400);
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await db.update(principal)
      .set({ password_hash: hashedPassword })
      .where(eq(principal.email, user.email));

    return apiResponse({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('CHANGE PASSWORD ERROR:', error);
    return apiError('Internal server error', 500);
  }
}

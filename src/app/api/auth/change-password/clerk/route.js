import { db } from '@/db';
import { clerks } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import bcrypt from 'bcrypt';

export async function POST(req) {
  try {
    const user = await getAuthUser('clerk');

    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { oldPassword, newPassword } = await req.json();

    const clerk = await db.query.clerks.findFirst({
      where: eq(clerks.email, user.email),
      columns: {
        password_hash: true
      }
    });

    if (!clerk) {
      return apiError('Clerk not found', 404);
    }

    const match = await bcrypt.compare(oldPassword, clerk.password_hash);

    if (!match) {
      return apiError('Invalid old password', 400);
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await db.update(clerks)
      .set({ password_hash: hashedPassword })
      .where(eq(clerks.email, user.email));

    return apiResponse({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('CHANGE PASSWORD ERROR:', error);
    return apiError('Internal server error', 500);
  }
}

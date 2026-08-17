import { db } from '@/db';
import { staffRegistrationRequests } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { wrapHandler } from '@/lib/api-utils';

export const GET = wrapHandler({
  auth: 'admin',
  handler: async () => {
    const requests = await db
      .select()
      .from(staffRegistrationRequests)
      .orderBy(desc(staffRegistrationRequests.created_at));

    return { success: true, requests };
  }
});

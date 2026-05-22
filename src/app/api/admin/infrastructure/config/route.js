import logger from '@/lib/logger';
import { db } from '@/db';
import { collegeInfo } from '@/db/schema';
import { getAuthUser, apiError, apiResponse } from '@/lib/api-utils';
import { eq } from 'drizzle-orm';

export async function GET(req) {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized', 401);

    const config = await db.query.collegeInfo.findFirst();
    return apiResponse({ config });
  } catch (error) {
    logger.error(error, 'Error fetching institutional config');
    return apiError('Internal Server Error', 500);
  }
}

export async function PATCH(req) {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized', 401);

    const updates = await req.json();
    
    const existing = await db.query.collegeInfo.findFirst();
    if (!existing) {
      await db.insert(collegeInfo).values(updates);
    } else {
      // Don't allow updating ID
      delete updates.id;
      delete updates.updated_at;
      
      await db.update(collegeInfo).set(updates).where(eq(collegeInfo.id, existing.id));
    }

    logger.warn(`[CONFIG_UPDATE] Admin ${user.email} updated institutional configuration.`);

    return apiResponse({ success: true, message: 'Configuration updated successfully.' });
  } catch (error) {
    logger.error(error, 'Error updating institutional config');
    return apiError('Internal Server Error', 500);
  }
}

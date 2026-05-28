import logger from '@/lib/logger';
import { db } from '@/db';
import { collegeInfo } from '@/db/schema';
import { getAuthUser, apiError, apiResponse } from '@/lib/api-utils';
import { eq } from 'drizzle-orm';
import { ValidationService } from '@/services/ValidationService';

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
    
    // Logic-level Dependency Check for Branch Removal
    if (existing && updates.branches) {
      const oldBranches = existing.branches || [];
      const newBranches = updates.branches || [];
      
      // Find removed branches
      const removedBranches = oldBranches.filter(b => !newBranches.includes(b));
      
      for (const branch of removedBranches) {
        const { canDelete, reason } = await ValidationService.checkBranchDependencies(branch);
        if (!canDelete) {
          return apiError(reason, 400);
        }
      }
    }

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
    if (error.status === 400) throw error; // Re-throw validation errors
    logger.error(error, 'Error updating institutional config');
    return apiError('Internal Server Error', 500);
  }
}

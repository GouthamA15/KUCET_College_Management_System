import logger from '@/lib/logger';
import { db } from '@/db';
import { staffAccounts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { storage } from '@/lib/providers';
import { encrypt } from '@/lib/encryption';
import { staffSchema } from '@/lib/validations/staff';
import { z } from 'zod';

export async function POST(req) {
  const user = await getAuthUser('staff');
  if (!user || !user.id) return apiError('Unauthorized', 401);

  try {
    const json = await req.json();

    // Validate with Zod
    const updateSchema = staffSchema.pick({
      name: true,
      email: true,
      mobile: true
    }).extend({
      address: z.string().trim().max(1000).nullable().optional(),
      pfp: z.string().nullable().optional(),
      signature: z.string().nullable().optional()
    }).partial();

    const validatedData = updateSchema.parse(json);
    const { name, email, mobile, pfp, signature, address } = validatedData;

    const currentStaff = await db.query.staffAccounts.findFirst({
      where: eq(staffAccounts.id, user.id)
    });

    if (!currentStaff) return apiError('Staff not found', 404);

    const updateData = {};

    if (name) updateData.name = name;
    if (email) updateData.email = email.toLowerCase();
    if (address !== undefined) updateData.address = address;
    if (mobile) {
      updateData.mobile_hash = encrypt(mobile);
    }

    const { STORAGE_FOLDERS } = await import('@/lib/storage-config');
    if (pfp && pfp.startsWith('data:image')) {
      if (currentStaff.pfp) await storage.delete(currentStaff.pfp);
      const res = await storage.upload(pfp, STORAGE_FOLDERS.STAFF_PFP);
      updateData.pfp = typeof res === 'string' ? res : res?.path;
    }

    if (signature && signature.startsWith('data:image')) {
      if (currentStaff.signature) await storage.delete(currentStaff.signature);
      const res = await storage.upload(signature, STORAGE_FOLDERS.STAFF_SIGNATURES);
      updateData.signature = typeof res === 'string' ? res : res?.path;
    }

    if (Object.keys(updateData).length === 0) {
      return apiError('No changes detected', 400);
    }

    await db.update(staffAccounts)
      .set(updateData)
      .where(eq(staffAccounts.id, user.id));

    // Realtime Broadcast
    try {
      const { broadcastUpdate } = await import('@/lib/sse');
      await broadcastUpdate('STAFF_UPDATED', {
        id: user.id,
        name: updateData.name || currentStaff.name,
        email: updateData.email || currentStaff.email,
        updated_at: new Date().toISOString()
      });
    } catch (_e) {
      // Non-blocking
    }

    return apiResponse({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.errors?.[0]?.message || 'Invalid input data', 400);
    }
    logger.error('Error updating staff profile:', error);
    return apiError('Internal Server Error', 500, error.message);
  }
}


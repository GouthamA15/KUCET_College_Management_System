import logger from '@/lib/logger';
import { db } from '@/db';
import { clerks } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { storage } from '@/lib/providers';
import { encrypt, hashForIndex } from '@/lib/encryption';
import { clerkSchema } from '@/lib/validations/staff';
import { z } from 'zod';

export async function POST(req) {
  const user = await getAuthUser('clerk');
  if (!user || !user.clerkId) return apiError('Unauthorized', 401);

  try {
    const json = await req.json();

    // Validate with Zod
    const updateSchema = clerkSchema.pick({
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

    const currentClerk = await db.query.clerks.findFirst({
      where: eq(clerks.id, user.clerkId)
    });

    if (!currentClerk) return apiError('Clerk not found', 404);

    const updateData = {};

    if (name) updateData.name = name;
    if (email) updateData.email = email.toLowerCase();
    if (address !== undefined) updateData.address = address;
    
    if (mobile) {
      updateData.mobile = encrypt(mobile);
      updateData.mobile_hash = hashForIndex(mobile);
    }

    if (pfp && pfp.startsWith('data:image')) {
      if (currentClerk.pfp) await storage.delete(currentClerk.pfp);
      updateData.pfp = await storage.upload(pfp, 'clerks/pfp');
    }

    if (signature && signature.startsWith('data:image')) {
      if (currentClerk.signature) await storage.delete(currentClerk.signature);
      updateData.signature = await storage.upload(signature, 'clerks/signatures');
    }

    if (Object.keys(updateData).length === 0) {
      return apiError('No changes detected', 400);
    }

    await db.update(clerks)
      .set(updateData)
      .where(eq(clerks.id, user.clerkId));

    return apiResponse({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.errors?.[0]?.message || 'Invalid input data', 400);
    }
    logger.error('Error updating clerk profile:', error);
    return apiError('Internal Server Error', 500, error.message);
  }
}

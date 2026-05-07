import logger from '@/lib/logger';
import { db } from '@/db';
import { clerks } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { uploadToCloudinary, deleteFromCloudinary } from '@/lib/cloudinary';
import { encrypt, hashForIndex } from '@/lib/encryption';

export async function POST(req) {
  const user = await getAuthUser('clerk');
  if (!user || !user.clerkId) return apiError('Unauthorized', 401);

  try {
    const body = await req.json();
    const { name, email, mobile, pfp, signature } = body;

    const currentClerk = await db.query.clerks.findFirst({
      where: eq(clerks.id, user.clerkId)
    });

    if (!currentClerk) return apiError('Clerk not found', 404);

    const updateData = {};

    if (name) updateData.name = name;
    if (email) updateData.email = email;
    
    if (mobile) {
      updateData.mobile = encrypt(mobile);
      updateData.mobile_hash = hashForIndex(mobile);
    }

    if (pfp && pfp.startsWith('data:image')) {
      if (currentClerk.pfp) await deleteFromCloudinary(currentClerk.pfp);
      updateData.pfp = await uploadToCloudinary(pfp, 'clerks/pfp');
    }

    if (signature && signature.startsWith('data:image')) {
      if (currentClerk.signature) await deleteFromCloudinary(currentClerk.signature);
      updateData.signature = await uploadToCloudinary(signature, 'clerks/signatures');
    }

    if (Object.keys(updateData).length === 0) {
      return apiError('No changes detected', 400);
    }

    await db.update(clerks)
      .set(updateData)
      .where(eq(clerks.id, user.clerkId));

    return apiResponse({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    logger.error('Error updating clerk profile:', error);
    return apiError('Internal Server Error', 500, error.message);
  }
}

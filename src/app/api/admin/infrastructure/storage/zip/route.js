import logger from '@/lib/logger';
import { getAuthUser, apiError } from '@/lib/api-utils';
import { v2 as cloudinary } from 'cloudinary';
import { NextResponse } from 'next/server';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function GET(req) {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized', 401);

    const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'cloudinary';

    if (storageType === 'cloudinary') {
      // Cloudinary has a built-in zip generator
      // We generate a signed URL that expires in 1 hour
      const zipUrl = cloudinary.utils.download_zip_url({
        prefixes: 'kucet',
        resource_type: 'image', // Need to handle raw separately? 
        // Cloudinary zip API is limited. Let's use the archive generation if possible.
      });
      
      // For images only above. To get everything, we need to use 'create_archive'
      const result = await cloudinary.uploader.create_archive({
        prefixes: 'kucet',
        target_public_id: `kucet_full_export_${new Date().getTime()}`,
        resource_type: 'image', // Still limited to one resource type in simple calls
      });

      return NextResponse.redirect(result.secure_url);
    } else {
      // Local storage zipping 
      // This would require a library like archiver or adm-zip.
      // For now, we'll return an error if the library is missing or suggest manual VPS access.
      return apiError('Local storage zipping requires server-side compression utilities. Please contact system admin for direct VPS access.', 501);
    }

  } catch (error) {
    logger.error(error, 'Error generating storage zip');
    return apiError('Internal Server Error', 500);
  }
}

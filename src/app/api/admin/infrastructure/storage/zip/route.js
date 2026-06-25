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

export async function GET(_req) {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized', 401);

    const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'cloudinary';

    if (storageType === 'cloudinary') {
      // Cloudinary has a built-in on-the-fly zip generator via signed URLs.
      // This bypasses the synchronous create_archive limits (10MB) and doesn't create persistent files.
      // We target the 'kucet' folder prefix.
      const zipUrl = cloudinary.utils.download_zip_url({
        prefixes: 'kucet/',
        resource_type: 'image',
        flatten_folders: false,
        use_original_filename: true,
        target_public_id: `kucet_full_export_${new Date().getTime()}`
      });

      if (!zipUrl) {
        throw new Error('Failed to generate signed download URL');
      }

      // Redirect the admin's browser directly to the Cloudinary zip generator
      return NextResponse.redirect(zipUrl);
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

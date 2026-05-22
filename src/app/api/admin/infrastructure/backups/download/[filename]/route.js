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

export async function GET(req, context) {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized', 401);

    const { filename } = await context.params;
    if (!filename) return apiError('Filename is required.', 400);

    // Validate filename: allow only alphanumerics, dots, dashes, underscores
    if (!/^[A-Za-z0-9._-]+$/.test(filename)) {
      return apiError('Invalid filename.', 400);
    }

    // Backups are stored with public_id = filename in 'kucet/backups' folder
    const publicId = `kucet/backups/${filename}`;
    
    // Since backups are 'authenticated', we generate a signed URL
    const downloadUrl = cloudinary.utils.private_download_url(publicId, 'sql', {
      resource_type: 'raw',
      attachment: true
    });

    return NextResponse.redirect(downloadUrl);
  } catch (error) {
    logger.error(error, 'Error serving backup download');
    return apiError('Internal Server Error', 500);
  }
}

import logger from '@/lib/logger';
import { getAuthUser, apiError, apiResponse } from '@/lib/api-utils';
import { v2 as cloudinary } from 'cloudinary';
import { getLocalStorageBasePath } from '@/lib/providers/storage/LocalStorageProvider';
import fs from 'fs';
import path from 'path';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Recursively list files in a local directory
 */
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

export async function GET(_req) {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized', 401);

    const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'cloudinary';
    let files = [];

    if (storageType === 'local') {
      const STORAGE_PATH = getLocalStorageBasePath();
      if (fs.existsSync(STORAGE_PATH)) {
        const localFiles = getAllFiles(STORAGE_PATH);
        files = localFiles.map(f => {
          const stats = fs.statSync(f);
          return {
            name: path.relative(STORAGE_PATH, f).replace(/\\\\/g, '/'),
            size: stats.size,
            created_at: stats.birthtime,
            type: 'local'
          };
        });
      }
    } else {
      // List from Cloudinary (kucet/ folder)
      // Note: resources_by_asset_folder only returns 1 level. 
      // To get EVERYTHING, we use the Search API.
      const result = await cloudinary.search
        .expression('folder:kucet/*')
        .sort_by('public_id', 'desc')
        .max_results(500)
        .execute();

      files = result.resources.map(r => ({
        name: r.public_id.replace(/^kucet\//, ''),
        size: r.bytes,
        created_at: r.created_at,
        type: 'cloudinary',
        secure_url: r.secure_url,
        format: r.format
      }));
    }

    return apiResponse({ files, storageType });
  } catch (error) {
    logger.error(error, 'Error exploring storage');
    return apiError('Internal Server Error', 500);
  }
}

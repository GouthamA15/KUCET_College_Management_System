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
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
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

/**
 * Recursively list subdirectories in a local directory
 */
function getAllDirectories(dirPath, basePath = dirPath, arrayOfDirs = []) {
  if (!fs.existsSync(dirPath)) return arrayOfDirs;
  const items = fs.readdirSync(dirPath);
  items.forEach((item) => {
    const fullPath = path.join(dirPath, item);
    if (fs.statSync(fullPath).isDirectory()) {
      const rel = path.relative(basePath, fullPath).replace(/\\/g, '/');
      arrayOfDirs.push(rel);
      getAllDirectories(fullPath, basePath, arrayOfDirs);
    }
  });
  return arrayOfDirs;
}

/**
 * Recursively fetch Cloudinary subfolder paths under a parent folder
 */
async function getCloudinaryFolders(parentPath = 'kucet') {
  let folders = [parentPath];
  try {
    const res = await cloudinary.api.sub_folders(parentPath);
    if (res.folders && Array.isArray(res.folders)) {
      for (const folder of res.folders) {
        const sub = await getCloudinaryFolders(folder.path);
        folders = folders.concat(sub);
      }
    }
  } catch (_err) {
    // If no subfolders or folder does not exist
  }
  return folders;
}

export async function GET(_req) {
  try {
    const user = await getAuthUser('admin');
    if (!user) return apiError('Unauthorized', 401);

    const storageType = (
      process.env.NEXT_PUBLIC_STORAGE_TYPE ||
      process.env.STORAGE_TYPE ||
      'cloudinary'
    ).toLowerCase();

    let files = [];
    let folders = [];

    if (storageType === 'local') {
      const STORAGE_PATH = getLocalStorageBasePath();
      if (fs.existsSync(STORAGE_PATH)) {
        const localFiles = getAllFiles(STORAGE_PATH);
        files = localFiles.map(f => {
          const stats = fs.statSync(f);
          return {
            name: path.relative(STORAGE_PATH, f).replace(/\\/g, '/'),
            size: stats.size,
            created_at: stats.birthtime,
            type: 'local'
          };
        });
        folders = getAllDirectories(STORAGE_PATH);
      }
    } else {
      // List all resources from Cloudinary under kucet (at all folder depths)
      const result = await cloudinary.search
        .expression('public_id:kucet* OR folder:kucet*')
        .sort_by('public_id', 'desc')
        .max_results(500)
        .execute();

      files = (result.resources || []).map(r => {
        let name = r.public_id;
        if (r.format && !name.endsWith(`.${r.format}`)) {
          name = `${name}.${r.format}`;
        }
        return {
          name,
          size: r.bytes,
          created_at: r.created_at,
          type: 'cloudinary',
          format: r.format
        };
      });

      folders = await getCloudinaryFolders('kucet');
    }

    return apiResponse({ files, folders, storageType });
  } catch (error) {
    logger.error(error, 'Error exploring storage');
    return apiError('Internal Server Error', 500);
  }
}

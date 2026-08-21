import StorageProvider, { StorageResult } from './StorageProvider';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getAssetUrl } from '@/lib/assets';
import { isInstitutionalAssetPath } from '@/lib/institution-assets';
import logger from '@/lib/logger';

function cleanRelativePath(assetPath) {
  if (!assetPath || typeof assetPath !== 'string') return '';
  if (assetPath.startsWith('data:')) return assetPath;
  let clean = assetPath;
  if (clean.includes('/api/assets/view/')) {
    clean = clean.split('/api/assets/view/')[1];
  }
  clean = clean.replace(/^https?:\/\/[^/]+/, '');
  clean = clean.replace(/^v\d+\//, '');
  clean = clean.replace(/^\/+/, '');
  return clean;
}

export function getLocalStorageBasePath() {
  if (process.env.LOCAL_STORAGE_PATH) {
    return process.env.LOCAL_STORAGE_PATH;
  }
  return path.join(process.cwd(), 'public', 'uploads');
}

export default class LocalStorageProvider extends StorageProvider {
  getUrl(assetPath) {
    if (!assetPath) return '';
    if (typeof assetPath !== 'string') return '';
    if (assetPath.startsWith('data:') || assetPath.startsWith('http://') || assetPath.startsWith('https://')) return assetPath;
    return getAssetUrl(assetPath);
  }

  async upload(file, folder, _publicId = null) {
    if (!file) return null;

    if (isInstitutionalAssetPath(folder)) {
      throw new Error('Public upload or modification of institutional assets is strictly prohibited.');
    }
    
    let buffer;
    let mimeType = 'application/octet-stream';

    // Handle File/Blob objects
    if (file && typeof file.arrayBuffer === 'function') {
      const bytes = await file.arrayBuffer();
      buffer = Buffer.from(bytes);
      mimeType = file.type || 'image/jpeg';
    } 
    // Handle Buffers
    else if (Buffer.isBuffer(file)) {
      buffer = file;
    } 
    // Handle Base64 strings
    else if (typeof file === 'string' && file.startsWith('data:')) {
      const matches = file.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        mimeType = matches[1];
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        buffer = Buffer.from(file, 'base64');
      }
    } else {
      throw new Error('Unsupported file type for local upload');
    }

    // 1MB Limit
    if (buffer.length > 1 * 1024 * 1024) {
      throw new Error(`File too large (${(buffer.length / 1024 / 1024).toFixed(2)}MB). Maximum allowed is 1MB.`);
    }

    const STORAGE_PATH = getLocalStorageBasePath();
    const rawFolder = folder ? folder.replace(/^\/+|\/+$/g, '') : 'uploads';
    const cleanFolder = rawFolder.replace(/^kucet\//, '');
    
    // Structure disk files under kucet/ subfolder for unified multi-provider layout
    const targetDir = STORAGE_PATH.endsWith('kucet')
      ? path.join(/* webpackIgnore: true */ /* turbopackIgnore: true */ STORAGE_PATH, cleanFolder)
      : path.join(/* webpackIgnore: true */ /* turbopackIgnore: true */ STORAGE_PATH, 'kucet', cleanFolder);
    
    await fs.promises.mkdir(targetDir, { recursive: true });

    let extension = '';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) extension = '.jpg';
    else if (mimeType.includes('png')) extension = '.png';
    else if (mimeType.includes('pdf')) extension = '.pdf';
    else if (mimeType.includes('webp')) extension = '.webp';
    else if (mimeType.includes('svg')) extension = '.svg';
    else if (mimeType.includes('heic')) extension = '.heic';
    else if (mimeType.includes('heif')) extension = '.heif';
    else extension = '.jpg';

    const randomStr = crypto.randomBytes(10).toString('hex');
    const filename = `${randomStr}${extension}`;
    const targetPath = path.join(targetDir, filename);

    await fs.promises.writeFile(targetPath, buffer);

    // Canonical relative storage key: kucet/<category>/<uuid>.<ext>
    const relPath = `kucet/${cleanFolder}/${filename}`;
    const url = `/api/assets/view/${relPath}`;

    return new StorageResult({
      path: relPath,
      url,
      filename,
      provider: 'local',
      mimeType,
      size: buffer.length
    });
  }

  async delete(relativePath) {
    if (!relativePath || typeof relativePath !== 'string' || relativePath.startsWith('data:')) return;
    
    const STORAGE_PATH = getLocalStorageBasePath();
    const cleanPath = cleanRelativePath(relativePath);
    if (!cleanPath || isInstitutionalAssetPath(cleanPath)) return;
    
    const candidatePaths = [
      path.join(/* webpackIgnore: true */ /* turbopackIgnore: true */ STORAGE_PATH, cleanPath),
      path.join(/* webpackIgnore: true */ /* turbopackIgnore: true */ STORAGE_PATH, 'kucet', cleanPath),
      path.join(/* webpackIgnore: true */ /* turbopackIgnore: true */ STORAGE_PATH, cleanPath.replace(/^kucet\//, ''))
    ];

    for (const targetPath of candidatePaths) {
      if (targetPath.startsWith(STORAGE_PATH) && fs.existsSync(targetPath)) {
        try {
          await fs.promises.unlink(targetPath);
          return;
        } catch (error) {
          if (error.code !== 'ENOENT') {
            logger.error({ err: error, targetPath }, 'LocalStorage Delete Error');
          }
        }
      }
    }
  }

  async copyFile(sourcePath, targetFolder) {
    if (!sourcePath || typeof sourcePath !== 'string' || sourcePath.startsWith('http') || sourcePath.startsWith('data:')) {
      return { newPath: sourcePath, sizeBytes: 0 };
    }

    const STORAGE_PATH = getLocalStorageBasePath();
    const cleanSource = cleanRelativePath(sourcePath);
    
    // Find existing source file among candidate locations
    const candidateSourcePaths = [
      path.join(/* webpackIgnore: true */ /* turbopackIgnore: true */ STORAGE_PATH, cleanSource),
      path.join(/* webpackIgnore: true */ /* turbopackIgnore: true */ STORAGE_PATH, 'kucet', cleanSource),
      path.join(/* webpackIgnore: true */ /* turbopackIgnore: true */ STORAGE_PATH, cleanSource.replace(/^kucet\//, ''))
    ];

    let absSource = null;
    for (const cand of candidateSourcePaths) {
      if (cand.startsWith(STORAGE_PATH) && fs.existsSync(cand)) {
        try {
          const s = fs.statSync(cand);
          if (s.isFile()) {
            absSource = cand;
            break;
          }
        } catch {}
      }
    }

    if (!absSource) {
      return { newPath: sourcePath, sizeBytes: 0 };
    }

    try {
      const stats = await fs.promises.stat(absSource);
      const filename = path.basename(cleanSource);
      const rawFolder = targetFolder.replace(/^\/+|\/+$/g, '');
      const cleanFolder = rawFolder.replace(/^kucet\//, '');
      
      const targetDir = STORAGE_PATH.endsWith('kucet')
        ? path.join(/* webpackIgnore: true */ /* turbopackIgnore: true */ STORAGE_PATH, cleanFolder)
        : path.join(/* webpackIgnore: true */ /* turbopackIgnore: true */ STORAGE_PATH, 'kucet', cleanFolder);
      
      await fs.promises.mkdir(targetDir, { recursive: true });

      const absTarget = path.join(targetDir, filename);
      await fs.promises.copyFile(absSource, absTarget);

      const relativeNewPath = `kucet/${cleanFolder}/${filename}`;
      return { newPath: relativeNewPath, sizeBytes: stats.size || 1024 };
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error({ err: error, sourcePath, targetFolder }, 'LocalStorage Copy File Error');
      }
      return { newPath: sourcePath, sizeBytes: 0 };
    }
  }

  async moveFile(sourcePath, targetFolder) {
    const copyResult = await this.copyFile(sourcePath, targetFolder);
    if (copyResult.newPath !== sourcePath) {
      await this.delete(sourcePath);
    }
    return copyResult;
  }
}



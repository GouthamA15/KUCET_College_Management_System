import StorageProvider, { StorageResult } from './StorageProvider';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

function cleanRelativePath(assetPath) {
  if (!assetPath || typeof assetPath !== 'string') return '';
  if (assetPath.startsWith('data:')) return assetPath;
  let clean = assetPath;
  if (clean.includes('/api/assets/view/')) {
    clean = clean.split('/api/assets/view/')[1];
  }
  clean = clean.replace(/^https?:\/\/[^/]+/, '');
  clean = clean.replace(/^v\d+\//, '');
  clean = clean.startsWith('/') ? clean.substring(1) : clean;
  return clean;
}

export default class LocalStorageProvider extends StorageProvider {
  getUrl(assetPath) {
    if (!assetPath) return '';
    if (typeof assetPath !== 'string') return '';
    if (assetPath.startsWith('data:') || assetPath.startsWith('http://') || assetPath.startsWith('https://')) return assetPath;
    
    const cleanPath = cleanRelativePath(assetPath);
    if (!cleanPath) return '';

    if (cleanPath.startsWith('assets/')) {
      return `/${cleanPath}`;
    }

    return `/api/assets/view/${cleanPath}`;
  }

  async upload(file, folder, _publicId = null) {
    if (!file) return null;
    
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

    const STORAGE_PATH = process.env.LOCAL_STORAGE_PATH || '/var/www/kucet-storage/uploads';
    const cleanFolder = folder ? folder.replace(/^\/+|\/+$/g, '') : 'uploads';
    const targetDir = path.join(STORAGE_PATH, cleanFolder);
    
    await fs.promises.mkdir(targetDir, { recursive: true });

    let extension = '';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) extension = '.jpg';
    else if (mimeType.includes('png')) extension = '.png';
    else if (mimeType.includes('pdf')) extension = '.pdf';
    else if (mimeType.includes('webp')) extension = '.webp';
    else if (mimeType.includes('svg')) extension = '.svg';
    else extension = '.jpg';

    const randomStr = crypto.randomBytes(10).toString('hex');
    const filename = `${randomStr}${extension}`;
    const targetPath = path.join(targetDir, filename);

    await fs.promises.writeFile(targetPath, buffer);

    const relPath = `${cleanFolder}/${filename}`;
    const url = `/api/assets/view/${relPath}`;

    return new StorageResult({
      path: relPath,
      url,
      filename,
      provider: 'local',
      mimeType
    });
  }

  async delete(relativePath) {
    if (!relativePath || typeof relativePath !== 'string' || relativePath.startsWith('data:')) return;
    
    const STORAGE_PATH = process.env.LOCAL_STORAGE_PATH || '/var/www/kucet-storage/uploads';
    const cleanPath = cleanRelativePath(relativePath);
    if (!cleanPath || cleanPath.startsWith('assets/')) return;
    
    const targetPath = path.join(STORAGE_PATH, cleanPath);

    // Security: Prevent Directory Traversal
    if (!targetPath.startsWith(STORAGE_PATH)) {
      return;
    }

    try {
      await fs.promises.unlink(targetPath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('LocalStorage Delete Error:', error);
      }
    }
  }

  async copyFile(sourcePath, targetFolder) {
    if (!sourcePath || typeof sourcePath !== 'string' || sourcePath.startsWith('http') || sourcePath.startsWith('data:')) {
      return { newPath: sourcePath, sizeBytes: 0 };
    }

    const STORAGE_PATH = process.env.LOCAL_STORAGE_PATH || '/var/www/kucet-storage/uploads';
    const cleanSource = cleanRelativePath(sourcePath);
    const absSource = path.join(STORAGE_PATH, cleanSource);

    if (!absSource.startsWith(STORAGE_PATH)) {
      return { newPath: sourcePath, sizeBytes: 0 };
    }

    try {
      const stats = await fs.promises.stat(absSource);
      const filename = path.basename(cleanSource);
      const cleanFolder = targetFolder.replace(/^\/+|\/+$/g, '');
      const targetDir = path.join(STORAGE_PATH, cleanFolder);
      await fs.promises.mkdir(targetDir, { recursive: true });

      const absTarget = path.join(targetDir, filename);
      await fs.promises.copyFile(absSource, absTarget);

      const relativeNewPath = `${cleanFolder}/${filename}`;
      return { newPath: relativeNewPath, sizeBytes: stats.size || 1024 };
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('LocalStorage Copy File Error:', error);
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



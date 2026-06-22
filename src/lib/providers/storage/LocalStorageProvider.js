import StorageProvider from './StorageProvider';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export default class LocalStorageProvider extends StorageProvider {
  getUrl(assetPath) {
    if (!assetPath) return '';
    if (assetPath.startsWith('data:') || assetPath.startsWith('http')) return assetPath;
    const cleanPath = assetPath.startsWith('/') ? assetPath.substring(1) : assetPath;
    return `/api/assets/view/${cleanPath}`;
  }

  async upload(file, folder, publicId = null) {
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
      const matches = file.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
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
    const targetDir = path.join(STORAGE_PATH, folder);
    
    await fs.promises.mkdir(targetDir, { recursive: true });

    let extension = '';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) extension = '.jpg';
    else if (mimeType.includes('png')) extension = '.png';
    else if (mimeType.includes('pdf')) extension = '.pdf';
    else if (mimeType.includes('webp')) extension = '.webp';
    else if (mimeType.includes('svg')) extension = '.svg';
    else extension = '.jpg';

    const randomArray = new Uint32Array(1);
    crypto.getRandomValues(randomArray);
    const filename = publicId ? `${publicId}${extension}` : `${Date.now()}-${randomArray[0]}${extension}`;
    const targetPath = path.join(targetDir, filename);

    await fs.promises.writeFile(targetPath, buffer);

    return `${folder}/${filename}`;
  }

  async delete(relativePath) {
    if (!relativePath || relativePath.startsWith('http') || relativePath.startsWith('data:')) return;
    
    const STORAGE_PATH = process.env.LOCAL_STORAGE_PATH || '/var/www/kucet-storage/uploads';
    const cleanPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
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
}

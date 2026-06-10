import StorageProvider from './StorageProvider';
import fs from 'fs/promises';
import path from 'path';
import logger from '@/lib/logger';

export default class LocalStorageProvider extends StorageProvider {
  constructor() {
    super();
    this.storagePath = process.env.LOCAL_STORAGE_PATH || '/app/public/uploads';
  }

  getUrl(path) {
    if (!path) return '';
    if (path.startsWith('data:') || path.startsWith('http') || path.startsWith('/api/')) return path;
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    
    // In production, we prefer direct /uploads/ access served by Nginx
    if (process.env.NODE_ENV === 'production') {
      return `/uploads/${cleanPath}`;
    }
    
    // In development or as fallback, use the API proxy
    return `/api/assets/view/${cleanPath}`;
  }

  async upload(file, folder, publicId) {
    try {
      if (!file) return null;

      let buffer;
      let filename = publicId || `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
      let extension = '.jpg';

      // 1. Convert various inputs to Buffer
      if (typeof file === 'string' && file.startsWith('data:')) {
        const parts = file.split(';base64,');
        const mime = parts[0].split(':')[1];
        const ext = mime.split('/')[1];
        extension = ext ? `.${ext}` : '.jpg';
        buffer = Buffer.from(parts[1], 'base64');
      } else if (Buffer.isBuffer(file)) {
        buffer = file;
      } else if (file instanceof File || (typeof file === 'object' && typeof file.arrayBuffer === 'function')) {
        const bytes = await file.arrayBuffer();
        buffer = Buffer.from(bytes);
        const nameParts = (file.name || '').split('.');
        if (nameParts.length > 1) {
          extension = `.${nameParts.pop().toLowerCase()}`;
          filename = nameParts.join('.');
        }
      } else {
        throw new Error('Unsupported file format for local storage');
      }

      // SECURITY: Enforce 1MB limit for image uploads
      if (buffer.length > 1 * 1024 * 1024) {
        throw new Error('File too large. Maximum allowed is 1MB.');
      }

      // 2. Prepare paths
      const relativePath = path.join('kucet', folder, `${filename}${extension}`).replace(/\\/g, '/');
      const absolutePath = path.join(this.storagePath, relativePath);
      const directory = path.dirname(absolutePath);

      // 3. Ensure directory exists
      await fs.mkdir(directory, { recursive: true });

      // 4. Write file
      await fs.writeFile(absolutePath, buffer);

      logger.info({ tag: 'LOCAL_UPLOAD_SUCCESS', path: relativePath }, 'File uploaded to local storage');
      return relativePath;
    } catch (error) {
      logger.error({ err: error, tag: 'LOCAL_UPLOAD_ERROR' }, 'Failed to upload to local storage');
      throw new Error(`Local storage upload failed: ${error.message}`);
    }
  }

  async delete(relativePath) {
    if (!relativePath) return;
    try {
      const absolutePath = path.resolve(this.storagePath, relativePath);
      
      // Security: Ensure path is within storagePath
      if (!absolutePath.startsWith(path.resolve(this.storagePath))) {
        logger.error({ tag: 'LOCAL_DELETE_SECURITY_VIOLATION', path: relativePath }, 'Attempted directory traversal in delete');
        return;
      }

      await fs.unlink(absolutePath);
      logger.info({ tag: 'LOCAL_DELETE_SUCCESS', path: relativePath }, 'File deleted from local storage');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error({ err: error, tag: 'LOCAL_DELETE_ERROR', path: relativePath }, 'Failed to delete from local storage');
      }
    }
  }
}

import StorageProvider from './StorageProvider';
import fs from 'fs/promises';
import path from 'path';
import logger from '@/lib/logger';

export default class LocalStorageProvider extends StorageProvider {
  constructor() {
    super();
    this.storagePath = process.env.LOCAL_STORAGE_PATH || '/app/public/uploads';
    
    // Perform a basic writability check on startup (server-side only)
    if (typeof window === 'undefined') {
        this._checkWritability();
    }
  }

  async _checkWritability() {
    try {
        const testFile = path.join(this.storagePath, '.write-test');
        await fs.mkdir(this.storagePath, { recursive: true });
        await fs.writeFile(testFile, 'test');
        await fs.unlink(testFile);
        logger.info({ tag: 'STORAGE_WRITABLE', path: this.storagePath }, '✅ Local storage volume is writable');
    } catch (e) {
        logger.error({ 
            tag: 'STORAGE_NOT_WRITABLE', 
            path: this.storagePath, 
            error: e.message,
            instruction: 'Ensure the host directory has correct permissions: chown -R 1001:1001 /var/www/kucet-storage'
        }, '❌ Local storage volume is NOT writable. Uploads will fail.');
    }
  }

  getUrl(path) {
    if (!path) return '';
    if (path.startsWith('data:') || path.startsWith('http') || path.startsWith('/api/') || path.startsWith('/uploads/')) return path;
    
    // Handle paths that start with 'uploads/' but missing leading slash
    if (path.startsWith('uploads/')) {
        return `/${path}`;
    }

    const rawPath = path.startsWith('/') ? path.substring(1) : path;
    
    // STRIP CLOUDINARY VERSION PREFIX (e.g., v1778170721/)
    let cleanPath = rawPath;
    if (cleanPath.match(/^v\d+\//)) {
      cleanPath = cleanPath.replace(/^v\d+\//, '');
    }
    
    // LEGACY CLOUDINARY ID RECOVERY (Matches getAssetUrl logic)
    // If the path has no slash, it's likely a legacy Cloudinary ID from a migration.
    // In the self-host volume, these are organized under kucet/students/pfp/
    let resolvedPath = cleanPath;
    if (!cleanPath.includes('/')) {
        resolvedPath = `kucet/students/pfp/${cleanPath}`;
    }

    // In production, we prefer direct /uploads/ access served by Nginx
    if (process.env.NODE_ENV === 'production') {
      return `/uploads/${resolvedPath}`;
    }
    
    // In development or as fallback, use the API proxy
    return `/api/assets/view/${resolvedPath}`;
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
      const MAX_SIZE = 1 * 1024 * 1024;
      if (buffer.length > MAX_SIZE) {
        throw new Error(`File too large (${(buffer.length / 1024 / 1024).toFixed(2)}MB). Maximum allowed is 1.00MB.`);
      }

      // 2. Prepare paths
      // In the local sovereign volume, everything is grouped under 'kucet/' to mirror Cloudinary structure
      const relativePath = path.join('kucet', folder, `${filename}${extension}`).replace(/\\/g, '/');
      const absolutePath = path.join(this.storagePath, relativePath);
      const directory = path.dirname(absolutePath);

      // 3. Ensure directory exists (with 755 permissions for Nginx access)
      await fs.mkdir(directory, { recursive: true, mode: 0o755 });

      // 4. Write file (with 644 permissions for Nginx access)
      await fs.writeFile(absolutePath, buffer, { mode: 0o644 });

      logger.info({ tag: 'LOCAL_UPLOAD_SUCCESS', path: relativePath, absolute: absolutePath }, 'File uploaded to local storage');
      return relativePath;
    } catch (error) {
      logger.error({ 
        err: error.message, 
        tag: 'LOCAL_UPLOAD_ERROR', 
        path: folder, 
        storagePath: this.storagePath,
        code: error.code
      }, `Failed to upload to local storage: ${error.message}`);
      
      if (error.code === 'EACCES' || error.code === 'EPERM') {
          throw new Error(`Permission denied: The server (UID 1001) cannot write to ${this.storagePath}. Run: chown -R 1001:1001 /var/www/kucet-storage`);
      }
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

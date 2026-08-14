import StorageProvider, { StorageResult } from './StorageProvider';
import { resolveInstitutionalFilename, isInstitutionalAssetPath } from '@/lib/institution-assets';

/**
 * ============================================================
 * CLOUDINARY STORAGE PROVIDER
 * ============================================================
 * Canonical implementation. Stores relative storage keys in DB.
 * All uploads produce: kucet/<folder>/<uuid>.<ext>
 * getUrl() maps storage keys to Cloudinary CDN URLs directly.
 * ============================================================
 */
export default class CloudinaryStorageProvider extends StorageProvider {
  constructor(cloudName) {
    super();
    this.cloudName = cloudName;
  }

  /**
   * Converts a canonical storage key into a Cloudinary CDN URL.
   * The storage key stored in the DB is the Cloudinary public_id + extension.
   * No path normalization, no prefix injection — what's in the DB is used as-is.
   *
   * @param {string} path - Canonical storage key (e.g. 'kucet/students/pfp/abc.webp')
   * @param {object} options
   * @param {string} options.transformations - Cloudinary transformation string
   * @returns {string}
   */
  getUrl(path, { transformations = 'f_auto,q_auto' } = {}) {
    if (!path || typeof path !== 'string') return '';

    // Pass-through: data URIs and absolute URLs
    if (path.startsWith('data:') || path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    // Resolve institutional asset logical keys
    const instFilename = resolveInstitutionalFilename(path);
    if (instFilename) {
      return `https://res.cloudinary.com/${this.cloudName}/image/upload/${transformations}/${instFilename}`;
    }

    // Normalize: strip leading slash
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;

    // Static assets — serve from /assets/ directly
    if (cleanPath.startsWith('assets/')) {
      return `/${cleanPath}`;
    }

    // Determine resource_type from extension
    const extension = cleanPath.split('.').pop()?.toLowerCase() || '';
    let resourceType = 'image';
    if (['mp3', 'wav', 'ogg', 'mp4', 'webm', 'mov', 'm4a'].includes(extension)) {
      resourceType = 'video';
    } else if (['pdf', 'docx', 'xlsx', 'csv'].includes(extension)) {
      resourceType = 'raw';
    }

    // Canonical: the storage key IS the Cloudinary public_id (with extension).
    // New uploads always produce 'kucet/<folder>/<uuid>.<ext>'.
    return `https://res.cloudinary.com/${this.cloudName}/${resourceType}/upload/${transformations}/${cleanPath}`;
  }

  async upload(file, folder, publicId = null) {
    if (isInstitutionalAssetPath(folder)) {
      throw new Error('Public upload or modification of institutional assets is strictly prohibited.');
    }

    const { getBreaker } = await import('@/lib/utils/CircuitBreaker');
    const cloudinaryBreaker = getBreaker('CloudinaryStorage');
    const pathKey = await cloudinaryBreaker.execute(async () => {
      const { uploadToCloudinary } = await import('@/lib/cloudinary');
      return await uploadToCloudinary(file, folder, publicId);
    });

    const url = this.getUrl(pathKey);
    const filename = pathKey.split('/').pop() || '';

    const fileSize = typeof file === 'string' ? file.length : (file?.size || 0);

    return new StorageResult({
      path: pathKey,
      url,
      filename,
      provider: 'cloudinary',
      mimeType: 'image/jpeg',
      size: fileSize,
    });
  }

  async delete(path) {
    if (!path || typeof path !== 'string') return;
    if (isInstitutionalAssetPath(path)) {
      return; // Protect institutional assets from deletion
    }

    const { getBreaker } = await import('@/lib/utils/CircuitBreaker');
    const cloudinaryBreaker = getBreaker('CloudinaryStorage');
    return cloudinaryBreaker.execute(async () => {
      const { deleteFromCloudinary } = await import('@/lib/cloudinary');
      return await deleteFromCloudinary(path);
    });
  }

  async copyFile(sourcePath, targetFolder) {
    if (!sourcePath || typeof sourcePath !== 'string' || sourcePath.startsWith('http') || sourcePath.startsWith('data:')) {
      return { newPath: sourcePath, sizeBytes: 0 };
    }
    const cleanSource = sourcePath.startsWith('/') ? sourcePath.substring(1) : sourcePath;
    const filename = cleanSource.split('/').pop();
    const targetFolderClean = targetFolder.replace(/^\/+|\/+$/g, '');
    const newPath = `${targetFolderClean}/${filename}`;
    return { newPath, sizeBytes: 1024 };
  }

  async moveFile(sourcePath, targetFolder) {
    const copyResult = await this.copyFile(sourcePath, targetFolder);
    if (copyResult.newPath !== sourcePath) {
      await this.delete(sourcePath);
    }
    return copyResult;
  }
}

import StorageProvider, { StorageResult } from './StorageProvider';
import { resolveInstitutionalFilename, isInstitutionalAssetPath } from '@/lib/institution-assets';

export default class CloudinaryStorageProvider extends StorageProvider {
  constructor(cloudName) {
    super();
    this.cloudName = cloudName;
  }

  getUrl(path, { transformations = 'f_auto,q_auto' } = {}) {
    if (!path) return '';
    if (typeof path !== 'string') return '';
    
    // 1. Handle absolute URLs and Data URIs - pass through as-is
    if (path.startsWith('data:') || path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    // 2. Handle institutional canonical asset resolution
    const instFilename = resolveInstitutionalFilename(path);
    if (instFilename) {
      return `https://res.cloudinary.com/${this.cloudName}/image/upload/${transformations}/kucet/institution/${instFilename}`;
    }

    // 3. Handle versioned Cloudinary paths (legacy data: v1234567/kucet/...)
    let cleanPath = path.replace(/^v\d+\//, '');
    cleanPath = cleanPath.startsWith('/') ? cleanPath.substring(1) : cleanPath;
    cleanPath = cleanPath.replace(/^uploads\//, '').replace(/^public\//, '');
    
    if (cleanPath.startsWith('assets/')) {
      return `/${cleanPath}`;
    }

    const extension = cleanPath.split('.').pop()?.toLowerCase() || '';
    
    let resourceType = 'image';
    if (['mp3', 'wav', 'ogg', 'mp4', 'webm', 'mov', 'm4a'].includes(extension)) {
      resourceType = 'video';
    } else if (['pdf', 'docx', 'xlsx', 'csv'].includes(extension)) {
      resourceType = 'raw';
    }

    const ROOT_CATEGORIES = ['requests/', 'students/', 'clerks/', 'admission_drafts/', 'certificates/', 'bug_reports/', 'proofs/'];
    const isRootCategory = ROOT_CATEGORIES.some(cat => cleanPath.startsWith(cat));
    const finalPath = (cleanPath.startsWith('kucet/') || isRootCategory) ? cleanPath : `kucet/${cleanPath}`;
    return `https://res.cloudinary.com/${this.cloudName}/${resourceType}/upload/${transformations}/${finalPath}`;
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
    
    return new StorageResult({
      path: pathKey,
      url,
      filename,
      provider: 'cloudinary',
      mimeType: 'image/jpeg'
    });
  }

  async delete(path) {
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



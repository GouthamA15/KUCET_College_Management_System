import StorageProvider, { StorageResult } from './StorageProvider';

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

    // 2. Handle versioned Cloudinary paths (legacy data: v1234567/kucet/...)
    let cleanPath = path.replace(/^v\d+\//, '');
    cleanPath = cleanPath.startsWith('/') ? cleanPath.substring(1) : cleanPath;
    
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

    const finalPath = cleanPath.includes('kucet/') ? cleanPath : `kucet/public/${cleanPath}`;
    return `https://res.cloudinary.com/${this.cloudName}/${resourceType}/upload/${transformations}/${finalPath}`;
  }

  async upload(file, folder, publicId = null) {
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



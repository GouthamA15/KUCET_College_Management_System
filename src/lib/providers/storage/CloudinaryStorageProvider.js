import StorageProvider from './StorageProvider';
import { uploadToCloudinary, deleteFromCloudinary } from '@/lib/cloudinary';

export default class CloudinaryStorageProvider extends StorageProvider {
  constructor(cloudName) {
    super();
    this.cloudName = cloudName;
  }

  getUrl(path, { transformations = 'f_auto,q_auto' } = {}) {
    if (!path) return '';
    
    // 1. Handle absolute URLs and Data URIs
    if (path.startsWith('data:') || path.startsWith('http')) {
      return path;
    }

    // 2. Normalize path
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    const extension = (cleanPath.split('.').pop() || '').toLowerCase();
    
    let resourceType = 'image';
    if (['mp3', 'wav', 'ogg', 'mp4', 'webm', 'mov', 'm4a'].includes(extension)) {
      resourceType = 'video';
    } else if (['pdf', 'docx', 'xlsx', 'csv'].includes(extension)) {
      resourceType = 'raw';
    }

    const finalPath = cleanPath.includes('kucet/') ? cleanPath : `kucet/public/${cleanPath}`;
    return `https://res.cloudinary.com/${this.cloudName}/${resourceType}/upload/${transformations}/${finalPath}`;
  }

  async upload(file, folder, publicId) {
    return await uploadToCloudinary(file, folder, publicId);
  }

  async delete(path) {
    return await deleteFromCloudinary(path);
  }
}

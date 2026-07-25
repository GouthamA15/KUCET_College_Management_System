import CloudinaryStorageProvider from './CloudinaryStorageProvider';
import LocalStorageProvider from './LocalStorageProvider';
import S3StorageProvider from './S3StorageProvider';

let instance = null;

export function getStorageProvider() {
  if (instance) return instance;

  const storageType = (process.env.NEXT_PUBLIC_STORAGE_TYPE || 'cloudinary').toLowerCase();

  if (storageType === 's3' || storageType === 'r2') {
    instance = new S3StorageProvider();
  } else if (storageType === 'local') {
    console.warn('LocalStorageProvider is deprecated for multi-node deployments. Prefer S3/R2 or Cloudinary in production.');
    instance = new LocalStorageProvider();
  } else {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 
                     process.env.CLOUDINARY_CLOUD_NAME || 
                     'djs0ry74r';
    instance = new CloudinaryStorageProvider(cloudName);
  }

  return instance;
}

import CloudinaryStorageProvider from './CloudinaryStorageProvider';
import LocalStorageProvider from './LocalStorageProvider';

let instance = null;

export function getStorageProvider() {
  if (instance) return instance;

  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'cloudinary';

  if (storageType === 'local') {
    instance = new LocalStorageProvider();
  } else {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 
                     process.env.CLOUDINARY_CLOUD_NAME || 
                     'djs0ry74r';
    instance = new CloudinaryStorageProvider(cloudName);
  }

  return instance;
}

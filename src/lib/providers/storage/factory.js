import CloudinaryStorageProvider from './CloudinaryStorageProvider';
import LocalStorageProvider from './LocalStorageProvider';
import S3StorageProvider from './S3StorageProvider';
import FailoverStorageProvider from './FailoverStorageProvider';

let instance = null;

export function getStorageProvider() {
  if (instance) return instance;

  const storageType = (
    process.env.STORAGE_PROVIDER ||
    process.env.NEXT_PUBLIC_STORAGE_PROVIDER ||
    process.env.NEXT_PUBLIC_STORAGE_TYPE || 
    process.env.STORAGE_TYPE || 
    'local'
  ).toLowerCase();

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 
                   process.env.CLOUDINARY_CLOUD_NAME || 
                   'djs0ry74r';

  const localProvider = new LocalStorageProvider();
  const cloudinaryProvider = new CloudinaryStorageProvider(cloudName);
  const s3Provider = new S3StorageProvider();

  let providers = [];
  if (storageType === 'local') {
    providers = [localProvider, cloudinaryProvider, s3Provider];
  } else if (storageType === 's3' || storageType === 'r2') {
    providers = [s3Provider, cloudinaryProvider, localProvider];
  } else {
    // default to cloudinary primary
    providers = [cloudinaryProvider, localProvider, s3Provider];
  }

  instance = new FailoverStorageProvider(providers);
  return instance;
}


import CloudinaryStorageProvider from './CloudinaryStorageProvider';
import LocalStorageProvider from './LocalStorageProvider';
import S3StorageProvider from './S3StorageProvider';
import FailoverStorageProvider from './FailoverStorageProvider';

let instance = null;

export function getStorageProvider() {
  if (instance) return instance;

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 
                   process.env.CLOUDINARY_CLOUD_NAME || 
                   'djs0ry74r';

  const s3Provider = new S3StorageProvider();
  const cloudinaryProvider = new CloudinaryStorageProvider(cloudName);
  const localProvider = new LocalStorageProvider();

  // Failover order: S3 -> Cloudinary -> Local
  instance = new FailoverStorageProvider([
    s3Provider,
    cloudinaryProvider,
    localProvider,
  ]);

  return instance;
}

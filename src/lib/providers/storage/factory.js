import LocalStorageProvider from './LocalStorageProvider';
import CloudinaryStorageProvider from './CloudinaryStorageProvider';
import S3StorageProvider from './S3StorageProvider';
import FailoverStorageProvider from './FailoverStorageProvider';
import logger from '@/lib/logger';

let instance = null;

/**
 * Returns the canonical managed StorageProvider.
 * Selected via environment configuration: 'local', 'cloudinary', 's3', 'r2'.
 * Defaults to 'local' for self-hosted VPS production.
 */
export function getStorageProvider() {
  if (instance) return instance;

  const storageType = (
    process.env.STORAGE_PROVIDER ||
    process.env.NEXT_PUBLIC_STORAGE_PROVIDER ||
    process.env.NEXT_PUBLIC_STORAGE_TYPE || 
    process.env.STORAGE_TYPE || 
    'local'
  ).toLowerCase().trim();

  if (storageType === 'cloudinary') {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    if (!cloudName) {
      const errorMsg = '[StorageProvider] STORAGE_PROVIDER is set to "cloudinary" but CLOUDINARY_CLOUD_NAME is missing.';
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    instance = new CloudinaryStorageProvider(cloudName);
    logger.info({ provider: 'cloudinary', cloudName }, '[StorageProvider] Initialized Cloudinary Storage Provider');
    return instance;
  }

  if (storageType === 's3' || storageType === 'r2') {
    const s3Provider = new S3StorageProvider();
    const localProvider = new LocalStorageProvider();
    instance = new FailoverStorageProvider([s3Provider, localProvider]);
    logger.info({ provider: storageType }, '[StorageProvider] Initialized S3/R2 Storage Provider with local failover');
    return instance;
  }

  // Canonical Local VPS Storage Provider exclusively
  const localProvider = new LocalStorageProvider();
  instance = localProvider;
  logger.info({ provider: 'local' }, '[StorageProvider] Initialized Local Storage Provider');
  return instance;
}

export function resetStorageProvider() {
  instance = null;
}




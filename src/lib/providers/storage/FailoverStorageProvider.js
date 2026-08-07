import StorageProvider from './StorageProvider';
import logger from '@/lib/logger';

export default class FailoverStorageProvider extends StorageProvider {
  /**
   * @param {Array<StorageProvider>} providers 
   */
  constructor(providers = []) {
    super();
    this.providers = providers.filter(Boolean);
  }

  getUrl(assetPath) {
    if (this.providers.length > 0) {
      // Delegate URL resolution to the primary active provider
      return this.providers[0].getUrl(assetPath);
    }
    return assetPath;
  }

  async upload(fileBuffer, key, options = {}) {
    let lastError = null;

    for (const provider of this.providers) {
      try {
        const result = await provider.upload(fileBuffer, key, options);
        return result;
      } catch (err) {
        lastError = err;
        logger.warn({ err: err.message, provider: provider.constructor.name, key }, '[StorageFailover] Primary provider failed, trying fallback provider');
      }
    }

    throw new Error(`All storage providers failed to upload key "${key}": ${lastError?.message}`);
  }

  async delete(key) {
    for (const provider of this.providers) {
      try {
        await provider.delete(key);
      } catch (err) {
        logger.warn({ err: err.message, provider: provider.constructor.name, key }, '[StorageFailover] Delete failed on provider');
      }
    }
    return true;
  }

  async copyFile(sourceKey, destKey) {
    let lastError = null;

    for (const provider of this.providers) {
      try {
        const result = await provider.copyFile(sourceKey, destKey);
        return result;
      } catch (err) {
        lastError = err;
        logger.warn({ err: err.message, provider: provider.constructor.name }, '[StorageFailover] copyFile failed, trying fallback');
      }
    }

    throw new Error(`All storage providers failed to copy file: ${lastError?.message}`);
  }

  async moveFile(sourceKey, destKey) {
    let lastError = null;

    for (const provider of this.providers) {
      try {
        const result = await provider.moveFile(sourceKey, destKey);
        return result;
      } catch (err) {
        lastError = err;
        logger.warn({ err: err.message, provider: provider.constructor.name }, '[StorageFailover] moveFile failed, trying fallback');
      }
    }

    throw new Error(`All storage providers failed to move file: ${lastError?.message}`);
  }
}

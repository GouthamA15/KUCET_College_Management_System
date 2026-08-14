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

  /**
   * Resolve a storage key to a publicly accessible URL.
   * Delegates to the first provider in the chain since URL generation
   * is deterministic and does not require failover.
   * @param {string} storageKey - The relative storage key (e.g., kucet/students/pfp/abc.jpg)
   * @param {Object} options - Optional transform options
   * @returns {string}
   */
  getUrl(storageKey, options = {}) {
    for (const provider of this.providers) {
      if (typeof provider.getUrl === 'function') {
        return provider.getUrl(storageKey, options);
      }
    }
    return storageKey;
  }

  async upload(fileBuffer, key, publicId = null) {
    let lastError = null;
    const cleanPublicId = typeof publicId === 'string' ? publicId : null;

    for (const provider of this.providers) {
      try {
        const result = await provider.upload(fileBuffer, key, cleanPublicId);
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

/**
 * Abstract base class for Storage Providers.
 */
export default class StorageProvider {
  /**
   * Resolve an asset URL.
   * @param {string} path 
   * @param {Object} options 
   * @returns {string}
   */
  getUrl(path, options) {
    throw new Error('Method not implemented');
  }
}

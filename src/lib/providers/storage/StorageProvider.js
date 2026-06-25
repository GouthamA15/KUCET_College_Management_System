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
  getUrl(_path, _options) {
    throw new Error('Method not implemented');
  }

  /**
   * Upload an asset.
   * @param {string|Buffer|File} file - The file to upload
   * @param {string} folder - The destination folder
   * @param {string} publicId - Optional public ID/filename
   * @returns {Promise<string>} - The relative path of the uploaded asset
   */
  async upload(file, folder, _publicId = null) {
    throw new Error('Method not implemented');
  }

  /**
   * Delete an asset.
   * @param {string} path - The relative path of the asset
   */
  async delete(_path) {
    throw new Error('Method not implemented');
  }
}

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

  /**
   * Copy an asset to a new destination folder.
   * @param {string} sourcePath - Relative path of source asset
   * @param {string} targetFolder - Destination folder path
   * @returns {Promise<{ newPath: string, sizeBytes: number }>}
   */
  async copyFile(_sourcePath, _targetFolder) {
    throw new Error('Method not implemented');
  }

  /**
   * Move an asset to a new destination folder.
   * @param {string} sourcePath - Relative path of source asset
   * @param {string} targetFolder - Destination folder path
   * @returns {Promise<{ newPath: string, sizeBytes: number }>}
   */
  async moveFile(_sourcePath, _targetFolder) {
    throw new Error('Method not implemented');
  }
}


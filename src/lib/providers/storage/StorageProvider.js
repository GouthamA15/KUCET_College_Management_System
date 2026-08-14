/**
 * Standardized result object returned by StorageProvider.upload()
 */
export class StorageResult {
  constructor({ path, url, filename, provider, mimeType, size = 0, version = null }) {
    this.path = path;
    this.url = url;
    this.filename = filename;
    this.provider = provider;
    this.mimeType = mimeType || 'application/octet-stream';
    this.size = size;
    if (version !== null && version !== undefined) {
      this.version = version;
    }
  }

  toString() {
    return this.path;
  }

  valueOf() {
    return this.path;
  }

  toJSON() {
    const res = {
      path: this.path,
      url: this.url,
      filename: this.filename,
      provider: this.provider,
      mimeType: this.mimeType,
      size: this.size,
    };
    if (this.version !== null && this.version !== undefined) {
      res.version = this.version;
    }
    return res;
  }
}

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
   * @returns {Promise<StorageResult>} - Standardized storage result
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



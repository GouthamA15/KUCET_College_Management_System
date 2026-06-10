/**
 * Abstract Storage Provider.
 * This defines the interface for all storage backends (Cloudinary, Local, etc.)
 */
export default class StorageProvider {
    /**
     * Get the full URL for an asset.
     * @param {string} _path 
     * @param {object} _options 
     * @returns {string}
     */
    getUrl(_path, _options) {
      throw new Error('Method not implemented');
    }
  
    /**
     * Upload an asset.
     * @param {string|Buffer|File} _file 
     * @param {string} _folder 
     * @param {string} _publicId 
     * @returns {Promise<string>} - The relative path of the uploaded asset
     */
    async upload(_file, _folder, _publicId) {
      throw new Error('Method not implemented');
    }
  
    /**
     * Delete an asset.
     * @param {string} _path 
     * @returns {Promise<void>}
     */
    async delete(_path) {
      throw new Error('Method not implemented');
    }
  }

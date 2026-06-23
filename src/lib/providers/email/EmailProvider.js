/**
 * Abstract base class for Email Providers.
 */
export default class EmailProvider {
  /**
   * Send an email.
   * @param {Object} options 
   * @param {string} options.to 
   * @param {string} options.subject 
   * @param {string} options.html 
   * @param {string} [options.text] 
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async send(_options) {
    throw new Error('Method not implemented');
  }
}

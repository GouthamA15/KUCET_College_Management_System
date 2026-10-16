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
   * @param {string} [options.category] 
   * @param {string} [options.replyTo] 
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async send(_options) {
    throw new Error('Method not implemented');
  }
}

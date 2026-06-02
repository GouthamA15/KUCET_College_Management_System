/**
 * Abstract base class for Realtime Providers.
 */
export default class RealtimeProvider {
  /**
   * Broadcast an event to all clients.
   * @param {string} type 
   * @param {Object} payload 
   * @returns {Promise<void>}
   */
  async broadcast(type, payload) {
    throw new Error('Method not implemented');
  }
}

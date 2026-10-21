import RealtimeProvider from './RealtimeProvider';

export default class HybridRealtimeProvider extends RealtimeProvider {
  constructor(providers = []) {
    super();
    this.providers = providers;
  }

  async broadcast(type, payload = {}, options = {}) {
    // Ensure all dual-published events share an identical eventId for browser-side deduplication
    const eventId = payload.eventId || `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const unifiedPayload = { ...payload, eventId };

    // Use allSettled to ensure one failing provider doesn't block others or crash the request
    await Promise.allSettled(this.providers.map((p) => p.broadcast(type, unifiedPayload, options)));
  }

  async disconnect() {
    await Promise.allSettled(
      this.providers.map((p) => (typeof p.disconnect === 'function' ? p.disconnect() : Promise.resolve()))
    );
  }
}

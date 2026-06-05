import RealtimeProvider from './RealtimeProvider';

export default class HybridRealtimeProvider extends RealtimeProvider {
  constructor(providers = []) {
    super();
    this.providers = providers;
  }

  async broadcast(type, payload) {
    // Use allSettled to ensure one failing provider (like offline Redis in dev) 
    // doesn't block others or crash the request
    await Promise.allSettled(this.providers.map(p => p.broadcast(type, payload)));
  }
}

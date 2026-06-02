import RealtimeProvider from './RealtimeProvider';

export default class HybridRealtimeProvider extends RealtimeProvider {
  constructor(providers = []) {
    super();
    this.providers = providers;
  }

  async broadcast(type, payload) {
    await Promise.all(this.providers.map(p => p.broadcast(type, payload)));
  }
}

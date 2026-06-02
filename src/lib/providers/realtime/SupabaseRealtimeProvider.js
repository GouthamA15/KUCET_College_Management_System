import RealtimeProvider from './RealtimeProvider';
import logger from '@/lib/logger';

export default class SupabaseRealtimeProvider extends RealtimeProvider {
  constructor(url, key) {
    super();
    this.url = url;
    this.key = key;
    this.supabase = null;
  }

  async init() {
    if (this.supabase) return;
    if (this.url && this.key) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        this.supabase = createClient(this.url, this.key);
      } catch (err) {
        logger.error(err, '[SUPABASE_INIT_FAILED]');
      }
    }
  }

  async broadcast(type, payload) {
    await this.init();
    if (!this.supabase) {
      logger.warn('[SUPABASE_BROADCAST_SKIPPED] Supabase not configured');
      return;
    }

    try {
      const data = {
        ...payload,
        type,
        timestamp: Date.now()
      };

      const channel = this.supabase.channel('kucet-updates');
      await channel.subscribe();
      await channel.send({
        type: 'broadcast',
        event: type,
        payload: data
      });
      logger.info({ type }, '[SUPABASE_BROADCAST_SUCCESS]');
    } catch (err) {
      logger.error(err, '[SUPABASE_BROADCAST_EXCEPTION]');
    }
  }
}

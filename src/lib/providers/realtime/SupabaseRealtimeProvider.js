import RealtimeProvider from './RealtimeProvider';
import logger from '@/lib/logger';
import { getBreaker } from '@/lib/utils/CircuitBreaker';

export default class SupabaseRealtimeProvider extends RealtimeProvider {
  constructor(url, key) {
    super();
    this.url = url;
    this.key = key;
    this.supabase = null;
    this.breaker = getBreaker('SupabaseRealtime');
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
    return await this.breaker.execute(async () => {
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
        throw err; // Re-throw for circuit breaker
      }
    });
  }
}

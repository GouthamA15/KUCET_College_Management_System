import RealtimeProvider from './RealtimeProvider';
import logger from '@/lib/logger';
import { getBreaker } from '@/lib/utils/CircuitBreaker';
import { resolveEventRooms, normalizeEventName } from '@/lib/events/realtime-events';

export default class SupabaseRealtimeProvider extends RealtimeProvider {
  constructor(url, key) {
    super();
    this.url = url;
    this.key = key;
    this.supabase = null;
    this.channel = null;
    this.roomChannels = new Map();
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

  async broadcast(type, payload = {}, options = {}) {
    return await this.breaker.execute(async () => {
      await this.init();
      if (!this.supabase) {
        logger.warn('[SUPABASE_BROADCAST_SKIPPED] Supabase not configured');
        return;
      }

      try {
        const canonicalType = normalizeEventName(type);
        const rooms = resolveEventRooms(type, payload, options);
        const isPublic = Boolean(options.isPublic || options.broadcastAll);
        const eventId = payload.eventId || `${canonicalType}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        const data = {
          eventId,
          ...payload,
          event: canonicalType,
          type: canonicalType,
          rooms,
          isPublic,
          timestamp: Date.now()
        };

        if (!this.channel) {
          this.channel = this.supabase.channel('kucet-updates');
          await this.channel.subscribe();
        }

        await this.channel.send({
          type: 'broadcast',
          event: canonicalType,
          payload: data
        });

        // If specific target room requested (e.g. match:123), also publish to room channel
        if (options.room) {
          const roomKey = String(options.room).trim();
          let roomCh = this.roomChannels.get(roomKey);
          if (!roomCh) {
            roomCh = this.supabase.channel(roomKey);
            await roomCh.subscribe();
            this.roomChannels.set(roomKey, roomCh);
          }
          await roomCh.send({
            type: 'broadcast',
            event: canonicalType,
            payload: data
          });
        }

        logger.info({ type: canonicalType, roomsCount: rooms.length, eventId }, '[SUPABASE_BROADCAST_SUCCESS]');
      } catch (err) {
        logger.error(err, '[SUPABASE_BROADCAST_EXCEPTION]');
        throw err; // Re-throw for circuit breaker
      }
    });
  }

  async disconnect() {
    if (this.channel) {
      try {
        await this.channel.unsubscribe();
      } catch (_e) { /* ignore */ }
      this.channel = null;
    }
    if (this.roomChannels && this.roomChannels.size > 0) {
      for (const ch of this.roomChannels.values()) {
        try {
          await ch.unsubscribe();
        } catch (_e) { /* ignore */ }
      }
      this.roomChannels.clear();
    }
    this.supabase = null;
  }
}

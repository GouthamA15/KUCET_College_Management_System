import RedisRealtimeProvider from './RedisRealtimeProvider';
import SupabaseRealtimeProvider from './SupabaseRealtimeProvider';
import HybridRealtimeProvider from './HybridRealtimeProvider';
import logger from '@/lib/logger';

let instance = null;

/**
 * Returns the centralized, authoritative Realtime Provider instance.
 * Supports configurable providers: 'socketio' (or 'redis'), 'supabase', or 'hybrid'.
 * Defaults to 'socketio' for self-hosted VPS production.
 */
export function getRealtimeProvider() {
  if (instance) return instance;

  const rawProvider = (
    process.env.REALTIME_PROVIDER ||
    process.env.NEXT_PUBLIC_REALTIME_PROVIDER ||
    'socketio'
  ).toLowerCase().trim();

  // Normalize aliases
  const providerType = rawProvider === 'redis' ? 'socketio' : rawProvider;

  if (providerType === 'socketio') {
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    instance = new RedisRealtimeProvider(redisUrl);
    logger.info({ provider: 'socketio', redisUrl }, '[RealtimeProvider] Initialized Socket.IO (Redis) Realtime Provider');
    return instance;
  }

  if (providerType === 'supabase') {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      const missing = [];
      if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
      if (!supabaseKey) missing.push('SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY');
      const errorMsg = `[RealtimeProvider] REALTIME_PROVIDER is set to "supabase" but required configuration is missing: ${missing.join(', ')}`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    instance = new SupabaseRealtimeProvider(supabaseUrl, supabaseKey);
    logger.info({ provider: 'supabase', supabaseUrl }, '[RealtimeProvider] Initialized Supabase Realtime Provider');
    return instance;
  }

  if (providerType === 'hybrid') {
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    const redisProvider = new RedisRealtimeProvider(redisUrl);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    const providers = [redisProvider];
    if (supabaseUrl && supabaseKey) {
      providers.push(new SupabaseRealtimeProvider(supabaseUrl, supabaseKey));
    } else {
      logger.warn('[RealtimeProvider] Hybrid mode active, but Supabase credentials not provided. Operating with Socket.IO only.');
    }

    instance = new HybridRealtimeProvider(providers);
    logger.info({ provider: 'hybrid', count: providers.length }, '[RealtimeProvider] Initialized Hybrid Realtime Provider');
    return instance;
  }

  throw new Error(`[RealtimeProvider] Unsupported REALTIME_PROVIDER: "${rawProvider}". Must be one of: socketio, redis, supabase, hybrid.`);
}

export function resetRealtimeProvider() {
  instance = null;
}



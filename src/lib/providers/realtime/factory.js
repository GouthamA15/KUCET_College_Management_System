import SupabaseRealtimeProvider from './SupabaseRealtimeProvider';
import RedisRealtimeProvider from './RedisRealtimeProvider';
import HybridRealtimeProvider from './HybridRealtimeProvider';

let instance = null;

export function getRealtimeProvider() {
  if (instance) return instance;

  const providers = [];

  if (process.env.REDIS_URL) {
    providers.push(new RedisRealtimeProvider(process.env.REDIS_URL));
  }

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    providers.push(new SupabaseRealtimeProvider(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ));
  }

  instance = new HybridRealtimeProvider(providers);
  return instance;
}

import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import logger from '@/lib/logger';

// Real-time Orchestration (Hybrid Strategy)
// 1. Redis (Primary for VPS): Pushes to local Socket.io server.
// 2. Supabase (Fallback for Vercel/Cloud): Broadcasts via Supabase network.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const REDIS_URL = process.env.REDIS_URL;

let supabase = null;
let redis = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

if (REDIS_URL) {
  try {
    redis = new Redis(REDIS_URL);
    redis.on('connect', () => {
      logger.info('[REDIS_CONNECTED]');
    });
    redis.on('error', (err) => {
      logger.error(err, '[REDIS_CONNECTION_ERROR]');
    });
    redis.on('end', () => {
      logger.warn('[REDIS_CONNECTION_ENDED]');
    });
    redis.on('ready', () => {
      logger.info('[REDIS_READY]');
    });
  } catch (err) {
    logger.error(err, '[REDIS_INIT_FAILED]');
  }
}

/**
 * Broadcasts a message to ALL connected clients.
 * Uses the configured realtime provider.
 * @param {string} type - Event type (e.g., 'TIMETABLE_CHANGED', 'SESSION_STARTED')
 * @param {Object} payload - Data associated with the event
 */
export async function broadcastUpdate(type, payload = {}) {
  try {
    const { realtime } = await import('./providers');
    await realtime.broadcast(type, payload);
  } catch (err) {
    logger.error(err, '[REALTIME_BROADCAST_EXCEPTION]');
  }
}

// LEGACY: Keeping these exports empty to prevent breaking existing imports in other files
export function addSSEClient() {}
export function removeSSEClient() {}

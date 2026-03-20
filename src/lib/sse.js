import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';

// Supabase Messaging Hub (Radio Tower)
// Used to broadcast real-time events across all users without a persistent local server.
// This enables 100% stable real-time on Serverless platforms like Vercel.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
  logger.warn('[REALTIME_INIT] Supabase keys missing. Real-time updates will be disabled.');
}

/**
 * Broadcasts a message to ALL connected clients via Supabase WebSocket network.
 * @param {string} type - Event type (e.g., 'TIMETABLE_CHANGED', 'SESSION_STARTED')
 * @param {Object} payload - Data associated with the event
 */
export async function broadcastUpdate(type, payload = {}) {
  if (!supabase) {
    logger.error('[REALTIME_BROADCAST_FAILED] Supabase not initialized');
    return;
  }

  try {
    const channel = supabase.channel('kucet-updates');
    
    // Broadcast message to all subscribers of this channel
    const result = await channel.send({
      type: 'broadcast',
      event: type,
      payload: {
        ...payload,
        timestamp: Date.now()
      }
    });

    if (result === 'ok') {
      logger.info({ type, payload }, '[REALTIME_BROADCAST_SUCCESS]');
    } else {
      logger.error({ result, type }, '[REALTIME_BROADCAST_ERROR] Supabase returned unexpected status');
    }
  } catch (err) {
    logger.error(err, '[REALTIME_BROADCAST_EXCEPTION]');
  }
}

// LEGACY: Keeping these exports empty to prevent breaking existing imports in other files
// but we no longer need local client tracking.
export function addSSEClient() {}
export function removeSSEClient() {}

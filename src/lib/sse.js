import logger from '@/lib/logger';

/**
 * Broadcasts a message to ALL connected clients.
 * Uses the configured realtime provider (Hybrid strategy).
 * @param {string} type - Event type (e.g., 'TIMETABLE_CHANGED', 'SESSION_STARTED')
 * @param {Object} payload - Data associated with the event
 */
export async function broadcastUpdate(type, payload = {}) {
  try {
    // Dynamic import to avoid bundling server-side providers into the client
    const { realtime } = await import('./providers');
    await realtime.broadcast(type, payload);
  } catch (err) {
    logger.error(err, '[REALTIME_BROADCAST_EXCEPTION]');
  }
}

// LEGACY: Keeping these exports empty to prevent breaking existing imports in other files
export function addSSEClient() {}
export function removeSSEClient() {}

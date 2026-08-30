import logger from '@/lib/logger';
import { normalizeEventName } from './events/realtime-events';

/**
 * Broadcasts a real-time event to connected clients across authorized rooms.
 * Uses the configured realtime provider (Hybrid strategy with Redis & optional Supabase).
 *
 * @param {string} type - Event type (e.g., 'ADMISSION_DRAFT_CREATED', 'request:updated')
 * @param {Object} payload - Data associated with the event (targeted/minimal payload)
 * @param {Object} options - Optional room targeting { room, rooms }
 */
export async function broadcastUpdate(type, payload = {}, options = {}) {
  try {
    const canonicalType = normalizeEventName(type);
    const { realtime } = await import('./providers');
    await realtime.broadcast(canonicalType, payload, options);
  } catch (err) {
    logger.error({ err, type }, '[REALTIME_BROADCAST_EXCEPTION]');
  }
}

// LEGACY: Keeping these exports to prevent breaking existing imports in other files
export function addSSEClient() {}
export function removeSSEClient() {}

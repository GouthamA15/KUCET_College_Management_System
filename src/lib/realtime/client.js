'use client';

import { io } from 'socket.io-client';
import { normalizeEventName, REALTIME_EVENTS } from '@/lib/events/realtime-events';
import { getClientSessionType, refreshClientSession } from '@/lib/client-auth';

// ---------------------------------------------------------------------------
// Global Shared Singleton State for all Realtime Listeners
// ---------------------------------------------------------------------------
let sharedSocket = null;
let sharedSupabase = null;
let sharedSupabaseChannel = null;
const supabaseRoomChannels = new Map();

let sharedStatus = 'disconnected'; // 'connected' | 'connecting' | 'reconnecting' | 'disconnected' | 'error'
const statusSubscribers = new Set();
const eventSubscribers = new Set();
const activeRooms = new Set();
const seenEventIds = new Map(); // deduplication cache: eventId -> timestamp

export function notifyStatus(status) {
  sharedStatus = status;
  statusSubscribers.forEach((subscriber) => {
    try {
      subscriber(status);
    } catch (error) {
      console.error('[Realtime] Status subscriber error', error);
    }
  });
}

export function deduplicateAndNotify(eventData) {
  if (!eventData || !eventData.type) return;

  const payload = eventData.payload || {};
  const eventId = payload.eventId || `${eventData.type}_${payload.timestamp || ''}_${payload.matchId || payload.match_id || payload.sessionId || payload.request_id || ''}`;

  const now = Date.now();
  if (seenEventIds.has(eventId)) {
    return; // Skip duplicate event
  }

  seenEventIds.set(eventId, now);
  if (seenEventIds.size > 300) {
    for (const [id, ts] of seenEventIds.entries()) {
      if (now - ts > 30000) seenEventIds.delete(id);
    }
  }

  eventSubscribers.forEach((subscriber) => {
    try {
      subscriber(eventData);
    } catch (error) {
      console.error('[Realtime] Event subscriber error', error);
    }
  });
}

/**
 * Returns current connection status ('connected' | 'connecting' | 'reconnecting' | 'disconnected' | 'error')
 */
export function getRealtimeStatus() {
  return sharedStatus;
}

/**
 * Subscribes to connection status transitions.
 */
export function subscribeToRealtimeStatus(callback) {
  statusSubscribers.add(callback);
  callback(sharedStatus);
  return () => {
    statusSubscribers.delete(callback);
  };
}

/**
 * Joins an authorized room or channel across active transport providers.
 * Tracks joined rooms so they are automatically re-joined upon reconnection.
 *
 * @param {string} room - Room name (e.g., 'match:123', 'dept:CSE')
 */
export function joinRealtimeRoom(room) {
  if (typeof window === 'undefined' || !room || typeof room !== 'string') return;
  const cleanRoom = room.trim();
  if (!cleanRoom) return;

  activeRooms.add(cleanRoom);

  // 1. Socket.IO Room Joining
  if (sharedSocket && sharedSocket.connected) {
    if (cleanRoom.startsWith('match:')) {
      const matchId = cleanRoom.replace('match:', '');
      sharedSocket.emit('join_match', matchId);
    }
    sharedSocket.emit('join_room', cleanRoom);
  }

  // 2. Supabase Channel Joining
  if (sharedSupabase && !supabaseRoomChannels.has(cleanRoom)) {
    try {
      const ch = sharedSupabase.channel(cleanRoom);
      ch.on('broadcast', { event: '*' }, ({ event, payload }) => {
        const canonicalType = normalizeEventName(event || payload?.type || payload?.event);
        deduplicateAndNotify({ type: canonicalType, payload });
      }).subscribe();
      supabaseRoomChannels.set(cleanRoom, ch);
    } catch (err) {
      console.warn('[Realtime:Supabase] Failed to join room channel:', cleanRoom, err);
    }
  }
}

/**
 * Leaves an active room across transport providers.
 *
 * @param {string} room - Room name (e.g., 'match:123')
 */
export function leaveRealtimeRoom(room) {
  if (typeof window === 'undefined' || !room || typeof room !== 'string') return;
  const cleanRoom = room.trim();

  activeRooms.delete(cleanRoom);

  // 1. Socket.IO Room Leaving
  if (sharedSocket && sharedSocket.connected) {
    if (cleanRoom.startsWith('match:')) {
      const matchId = cleanRoom.replace('match:', '');
      sharedSocket.emit('leave_match', matchId);
    }
    sharedSocket.emit('leave_room', cleanRoom);
  }

  // 2. Supabase Channel Leaving
  if (supabaseRoomChannels.has(cleanRoom)) {
    try {
      const ch = supabaseRoomChannels.get(cleanRoom);
      ch.unsubscribe();
      supabaseRoomChannels.delete(cleanRoom);
    } catch (_e) {
      // ignore
    }
  }
}

// ---------------------------------------------------------------------------
// Provider Resolution and Connection Lifecycle
// ---------------------------------------------------------------------------
let lastSilentRefreshTime = 0;

async function trySilentTokenRefresh() {
  const now = Date.now();
  if (now - lastSilentRefreshTime < 15000) return false;
  lastSilentRefreshTime = now;
  try {
    const userType = getClientSessionType() || 'staff';
    const res = await refreshClientSession(userType);
    return !!(res && res.ok);
  } catch (_e) {
    return false;
  }
}

/**
 * Disconnects all active transport sockets and channels.
 */
export function disconnectRealtimeSocket() {
  if (sharedSocket) {
    try {
      sharedSocket.removeAllListeners();
      sharedSocket.disconnect();
    } catch (_e) {
      // ignore
    }
    sharedSocket = null;
  }

  if (sharedSupabaseChannel) {
    try {
      sharedSupabaseChannel.unsubscribe();
    } catch (_e) {
      // ignore
    }
    sharedSupabaseChannel = null;
  }

  if (supabaseRoomChannels.size > 0) {
    for (const ch of supabaseRoomChannels.values()) {
      try {
        ch.unsubscribe();
      } catch (_e) {
        // ignore
      }
    }
    supabaseRoomChannels.clear();
  }
  sharedSupabase = null;

  activeRooms.clear();
  notifyStatus('disconnected');
}

export const disconnectRealtime = disconnectRealtimeSocket;

/**
 * Subscribes a listener to real-time events. Ensures connection is active.
 */
export function subscribeToRealtimeEvents(callback) {
  if (typeof window === 'undefined') return () => {};
  ensureRealtimeConnection();
  eventSubscribers.add(callback);
  return () => {
    eventSubscribers.delete(callback);
  };
}

/**
 * Authoritative connection manager. Respects NEXT_PUBLIC_REALTIME_PROVIDER ('socketio' | 'supabase' | 'hybrid').
 */
export function ensureRealtimeConnection() {
  if (typeof window === 'undefined') return;

  const rawProvider = (
    process.env.NEXT_PUBLIC_REALTIME_PROVIDER ||
    'socketio'
  ).toLowerCase().trim();

  const providerType = rawProvider === 'redis' ? 'socketio' : rawProvider;

  if (providerType === 'supabase') {
    initSupabaseConnection();
  } else if (providerType === 'hybrid') {
    initSocketIOConnection();
    initSupabaseConnection();
  } else {
    // Default to socketio
    initSocketIOConnection();
  }
}

function initSocketIOConnection() {
  if (sharedSocket && sharedSocket.connected) return;

  if (sharedSocket) {
    if (sharedSocket.disconnected) {
      sharedSocket.connect();
    }
    return;
  }

  notifyStatus('connecting');

  let socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (typeof window !== 'undefined') {
    const isLocalhostHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!socketUrl || (!isLocalhostHost && (socketUrl.includes('localhost') || socketUrl.includes('127.0.0.1')))) {
      socketUrl = window.location.origin;
    }
  } else {
    socketUrl = socketUrl || 'http://localhost:4000';
  }

  sharedSocket = io(socketUrl, {
    path: '/socket.io/',
    transports: ['websocket', 'polling'],
    withCredentials: true,
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 30000,
    randomizationFactor: 0.5,
    timeout: 8000,
  });

  let hasWarnedSocketError = false;

  sharedSocket.on('connect', () => {
    hasWarnedSocketError = false;
    notifyStatus('connected');

    // Re-join all active rooms upon connection or reconnection
    activeRooms.forEach((room) => {
      if (room.startsWith('match:')) {
        sharedSocket.emit('join_match', room.replace('match:', ''));
      }
      sharedSocket.emit('join_room', room);
    });
  });

  sharedSocket.on('reconnect_attempt', () => {
    notifyStatus('reconnecting');
  });

  sharedSocket.on('connect_error', (err) => {
    const msg = err?.message || '';
    const isAuthFailure =
      msg.includes('Authentication') ||
      msg.includes('exp') ||
      msg.includes('expired') ||
      msg.includes('Invalid or expired');

    if (isAuthFailure) {
      console.info('[Realtime] Auth token expired — attempting silent refresh before reconnect');
      trySilentTokenRefresh().then((refreshed) => {
        if (refreshed) {
          console.info('[Realtime] Token refreshed — socket will reconnect with new session');
        } else {
          console.warn('[Realtime] Token refresh failed');
        }
      });
    } else if (!hasWarnedSocketError) {
      console.warn('[Realtime] Socket connection error (will retry with bounded backoff):', msg);
      hasWarnedSocketError = true;
    }
    notifyStatus('error');
  });

  sharedSocket.on('reconnect_failed', () => {
    console.info('[Realtime] Reconnection attempts exhausted. Operating in fallback HTTP/API mode.');
    notifyStatus('disconnected');
  });

  sharedSocket.on('disconnect', (reason) => {
    notifyStatus('disconnected');
    if (reason === 'io server disconnect') {
      sharedSocket.connect();
    }
  });

  // Listen to generic live session updates
  sharedSocket.on('live-session-update', (data) => {
    const canonicalType = normalizeEventName(data.type || data.event);
    deduplicateAndNotify({ type: canonicalType, payload: data });
  });

  // Listen to canonical events
  Object.values(REALTIME_EVENTS).forEach((eventName) => {
    sharedSocket.on(eventName, (data) => {
      deduplicateAndNotify({ type: eventName, payload: data });
    });
  });
}

async function initSupabaseConnection() {
  if (sharedSupabase) return;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('[Realtime:Supabase] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY missing. Supabase listener inactive.');
    return;
  }

  try {
    notifyStatus('connecting');
    const { createClient } = await import('@supabase/supabase-js');
    sharedSupabase = createClient(supabaseUrl, supabaseKey);

    sharedSupabaseChannel = sharedSupabase.channel('kucet-updates');
    sharedSupabaseChannel
      .on('broadcast', { event: '*' }, ({ event, payload }) => {
        const canonicalType = normalizeEventName(event || payload?.type || payload?.event);
        deduplicateAndNotify({ type: canonicalType, payload });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          notifyStatus('connected');
          // Re-join any active rooms
          activeRooms.forEach((room) => {
            if (!supabaseRoomChannels.has(room)) {
              try {
                const ch = sharedSupabase.channel(room);
                ch.on('broadcast', { event: '*' }, ({ event, payload }) => {
                  const canonicalType = normalizeEventName(event || payload?.type || payload?.event);
                  deduplicateAndNotify({ type: canonicalType, payload });
                }).subscribe();
                supabaseRoomChannels.set(room, ch);
              } catch (err) {
                console.warn('[Realtime:Supabase] Room subscribe failed:', room, err);
              }
            }
          });
        } else if (status === 'CLOSED') {
          notifyStatus('disconnected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          notifyStatus('error');
        }
      });
  } catch (err) {
    console.error('[Realtime:Supabase] Initialization failed:', err);
    notifyStatus('error');
  }
}

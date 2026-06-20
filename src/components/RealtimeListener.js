'use client';

import { useEffect, useRef, useContext, useCallback, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { StudentContext } from '@/context/StudentContext';
import { ClerkContext } from '@/context/ClerkContext';

// Shared state for all instances of RealtimeListener
let sharedSupabaseClient = null;
let sharedSupabaseChannel = null;
let sharedSocket = null;
let sharedStatus = 'connecting';
let lastActivity = Date.now();
let heartbeatInterval = null;
const statusSubscribers = new Set();
const eventSubscribers = new Set();

function notifyStatus(status) {
  sharedStatus = status;
  statusSubscribers.forEach((subscriber) => {
    try {
      subscriber(status);
    } catch (error) {
      console.error('Realtime status subscriber error', error);
    }
  });
}

function notifyEvent(event) {
  eventSubscribers.forEach((subscriber) => {
    try {
      subscriber(event);
    } catch (error) {
      console.error('Realtime event subscriber error', error);
    }
  });
}

/**
 * Strategy A: VPS Mode (Socket.io)
 */
function ensureSocketConnection() {
  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (!socketUrl || sharedSocket || typeof window === 'undefined') return;

  const isLocal = socketUrl.includes('localhost') || socketUrl.includes('127.0.0.1');
  const isDev = process.env.NODE_ENV === 'development';

  if (!isLocal) {
    // console.log('🔌 [Socket.io] Connecting to', socketUrl);
  }
  
  sharedSocket = io(socketUrl, {
    transports: ['websocket'],
    reconnectionAttempts: isDev ? 1 : 5, // Minimal attempts in dev
    timeout: 3000,
    autoConnect: true
  });

  sharedSocket.on('connect', () => {
    // console.log('✅ [Socket.io] Connected');
    notifyStatus('connected');
  });

  sharedSocket.on('live-session-update', (data) => {
    notifyEvent({ type: data.type, payload: data });
  });

  sharedSocket.on('connect_error', (err) => {
    // Suppress logs for local failures to keep console clean
    if (!isLocal) {
      // console.warn('⚠️ [Realtime] Socket.io Error:', err.message);
    }
    notifyStatus('error');
  });

  sharedSocket.on('disconnect', () => {
    notifyStatus('disconnected');
  });
}

/**
 * Strategy B: Cloud Mode (Supabase)
 */
function getSharedSupabaseClient() {
  if (sharedSupabaseClient) return sharedSupabaseClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  // Allow Supabase if Socket.io is not connected
  const isSocketActive = sharedSocket && sharedSocket.connected;
  if (!url || !key || typeof window === 'undefined' || isSocketActive) return null;

  sharedSupabaseClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return sharedSupabaseClient;
}

function startSupabaseHeartbeat() {
  if (heartbeatInterval) return;
  
  heartbeatInterval = setInterval(() => {
    if (!sharedSupabaseChannel) return;
    
    // 1. Send Ping to self and others to verify channel health
    sharedSupabaseChannel.send({
      type: 'broadcast',
      event: 'PING',
      payload: { timestamp: Date.now() }
    }).catch(() => {});
    
    // 2. Check for Zombie State (No activity for 35s)
    const silentPeriod = Date.now() - lastActivity;
    if (silentPeriod > 35000) {
      // console.warn(`🧟 [Realtime] Zombie connection detected (${Math.round(silentPeriod/1000)}s silence). Forcing recovery...`);
      recoverSupabaseConnection();
    }
  }, 30000);
}

function recoverSupabaseConnection() {
  if (sharedSupabaseChannel) {
    // console.log('🔄 [Realtime] Re-subscribing to Supabase channel...');
    sharedSupabaseChannel.unsubscribe();
    sharedSupabaseChannel = null;
  }
  ensureSupabaseChannel();
}

function ensureSupabaseChannel() {
  const supabase = getSharedSupabaseClient();
  const isSocketActive = sharedSocket && (sharedSocket.connected || sharedStatus === 'connected');
  
  if (!supabase || isSocketActive || sharedSupabaseChannel) return;

  sharedSupabaseChannel = supabase.channel('kucet-updates', {
    config: { broadcast: { self: true } }, // self: true allows us to see our own pings back
  });

  sharedSupabaseChannel
    .on('broadcast', { event: '*' }, ({ event, payload }) => {
      lastActivity = Date.now(); // Update on any activity
      
      // Ignore internal PINGs for UI updates
      if (event !== 'PING') {
        notifyEvent({ type: event, payload });
      }
    })
    .subscribe((status) => {
      // Only set status if socket isn't already taking precedence
      if (!sharedSocket || !sharedSocket.connected) {
        if (status === 'SUBSCRIBED') {
          lastActivity = Date.now();
          notifyStatus('connected');
          startSupabaseHeartbeat();
        } else {
          notifyStatus(status);
        }
      }
    });
}

export default function RealtimeListener({ onUpdate, enableNotifications = false }) {
  const { studentData } = useContext(StudentContext) || {};
  const { clerkData } = useContext(ClerkContext) || {};
  
  const studentDataRef = useRef(studentData);
  const clerkDataRef = useRef(clerkData);
  const [status, setStatus] = useState(sharedStatus);

  useEffect(() => {
    studentDataRef.current = studentData;
    clerkDataRef.current = clerkData;
  }, [studentData, clerkData]);

  const handleNotification = useCallback((event, payload) => {
    const sData = studentDataRef.current;
    const cData = clerkDataRef.current;

    // console.log('📡 [Realtime Event]', event, payload);

    if (event === 'TIMETABLE_CHANGED') {
      if (sData?.branch === payload.branch) {
        toast.success('Your timetable has been updated!', { id: 'timetable-update' });
      }
    }

    if (event === 'SESSION_STARTED') {
      if (sData?.branch === payload.branch) {
        toast('🚀 New Attendance Session Started!', { icon: '📝', duration: 10000, id: payload.sessionId });
      }
    }

    if (event === 'REQUEST_CREATED' || event === 'REQUEST_UPDATED') {
      if (cData && payload.clerkType === cData.role) {
         toast(`New request: ${payload.certificate_type}`, { icon: '🔔' });
      }
      if (sData && payload.student_id === sData.id) {
         toast(`Request status updated: ${payload.certificate_type}`, { icon: '📄' });
      }
    }
  }, []);

  useEffect(() => {
    const statusHandler = (nextStatus) => setStatus(nextStatus);
    const eventHandler = ({ type, payload }) => {
      if (typeof onUpdate === 'function') onUpdate({ type, payload });
      if (enableNotifications) handleNotification(type, payload || {});
    };

    statusSubscribers.add(statusHandler);
    eventSubscribers.add(eventHandler);
    
    // Initialize primary or secondary strategy
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
    const isLocal = socketUrl?.includes('localhost') || socketUrl?.includes('127.0.0.1');
    const isDev = process.env.NODE_ENV === 'development';

    // Strategy: Skip Socket.io on localhost in Dev if Supabase is available
    // to avoid persistent connection failure errors in the console.
    const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const shouldSkipSocket = isDev && isLocal && hasSupabase;
    
    if (socketUrl && !shouldSkipSocket) {
      ensureSocketConnection();
      
      // Secondary fallback logic: if socket is still connecting after 5 seconds, 
      // check if we should enable Supabase as a backup.
      // But avoid dual connections.
      const fallbackTimer = setTimeout(() => {
        if (sharedStatus !== 'connected' && sharedStatus !== 'error') {
          // console.log('⚠️ [Realtime] Socket.io taking too long, checking Supabase availability...');
          ensureSupabaseChannel();
        }
      }, 5000);
      
      return () => {
        clearTimeout(fallbackTimer);
        statusSubscribers.delete(statusHandler);
        eventSubscribers.delete(eventHandler);
      };
    } else {
      // In Dev/Local or if no Socket URL, go straight to Supabase
      if (shouldSkipSocket) {
        // console.log('🚀 [Realtime] Dev Mode: Prioritizing Supabase over local Socket.io');
      }
      ensureSupabaseChannel();
      return () => {
        statusSubscribers.delete(statusHandler);
        eventSubscribers.delete(eventHandler);
      };
    }
  }, [enableNotifications, handleNotification, onUpdate]);

  return null;
}

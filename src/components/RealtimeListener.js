'use client';

import { useEffect, useRef, useContext, useCallback, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { StudentContext } from '@/context/StudentContext';
import { ClerkContext } from '@/context/ClerkContext';

// Shared state for all instances of RealtimeListener
let sharedSupabaseClient = null;
let sharedSocket = null;
let sharedStatus = 'connecting';
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

  console.log('🔌 [Socket.io] Connecting to', socketUrl);
  sharedSocket = io(socketUrl, {
    transports: ['websocket'],
    reconnectionAttempts: 5,
    timeout: 10000
  });

  sharedSocket.on('connect', () => {
    console.log('✅ [Socket.io] Connected');
    notifyStatus('connected');
  });

  sharedSocket.on('live-session-update', (data) => {
    notifyEvent({ type: data.type, payload: data });
  });

  sharedSocket.on('connect_error', (err) => {
    // Only log if it's not a localhost connection failure (common in dev without server)
    if (!socketUrl.includes('localhost')) {
      console.warn('⚠️ [Realtime] Connection Error', err.message);
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
  if (!url || !key || typeof window === 'undefined' || sharedSocket) return null;

  sharedSupabaseClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return sharedSupabaseClient;
}

function ensureSupabaseChannel() {
  const supabase = getSharedSupabaseClient();
  if (!supabase || sharedSocket) return;

  const channel = supabase.channel('kucet-updates', {
    config: { broadcast: { ack: true } },
  });

  channel
    .on('broadcast', { event: '*' }, ({ event, payload }) => {
      notifyEvent({ type: event, payload });
    })
    .subscribe((status) => {
      notifyStatus(status === 'SUBSCRIBED' ? 'connected' : status);
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

    console.log('📡 [Realtime Event]', event, payload);

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
    
    if (socketUrl) {
      ensureSocketConnection();
      
      // Secondary fallback logic: if socket is still connecting after 5 seconds, 
      // check if we should enable Supabase as a backup.
      // But avoid dual connections.
      const fallbackTimer = setTimeout(() => {
        if (sharedStatus !== 'connected' && sharedStatus !== 'error') {
          console.log('⚠️ [Realtime] Socket.io taking too long, checking Supabase availability...');
          ensureSupabaseChannel();
        }
      }, 5000);
      
      return () => {
        clearTimeout(fallbackTimer);
        statusSubscribers.delete(statusHandler);
        eventSubscribers.delete(eventHandler);
      };
    } else {
      ensureSupabaseChannel();
    }
  }, [enableNotifications, handleNotification, onUpdate]);

  return null;
}

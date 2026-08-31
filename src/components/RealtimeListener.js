'use client';

import { useEffect, useRef, useContext, useCallback, useState } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { StudentContext } from '@/context/StudentContext';
import { StaffContext } from '@/context/StaffContext';
import { normalizeEventName, REALTIME_EVENTS } from '@/lib/events/realtime-events';

// Global shared singleton state for all instances of RealtimeListener across the React tree
let sharedSocket = null;
let sharedStatus = 'disconnected'; // 'connected' | 'connecting' | 'reconnecting' | 'disconnected' | 'error'
const statusSubscribers = new Set();
const eventSubscribers = new Set();

function notifyStatus(status) {
  sharedStatus = status;
  statusSubscribers.forEach((subscriber) => {
    try {
      subscriber(status);
    } catch (error) {
      console.error('[Realtime] Status subscriber error', error);
    }
  });
}

function notifyEvent(eventData) {
  eventSubscribers.forEach((subscriber) => {
    try {
      subscriber(eventData);
    } catch (error) {
      console.error('[Realtime] Event subscriber error', error);
    }
  });
}

/**
 * Initializes and maintains a single centralized Socket.IO connection.
 */
let isRefreshingToken = false;

async function trySilentTokenRefresh() {
  if (isRefreshingToken) return false;
  isRefreshingToken = true;
  try {
    // Attempt to refresh all possible role tokens. The server ignores missing refresh tokens.
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ type: 'staff' }),
    });
    return res.ok;
  } catch (_e) {
    return false;
  } finally {
    isRefreshingToken = false;
  }
}

function ensureSocketConnection() {
  if (typeof window === 'undefined' || (sharedSocket && sharedSocket.connected)) return;

  if (sharedSocket) {
    if (sharedSocket.disconnected) {
      sharedSocket.connect();
    }
    return;
  }

  notifyStatus('connecting');

  // If NEXT_PUBLIC_SOCKET_URL is set, use it; otherwise use window.location.origin (proxied by Nginx /socket.io/)
  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin;

  sharedSocket = io(socketUrl, {
    path: '/socket.io/',
    transports: ['websocket', 'polling'],
    withCredentials: true,
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 10000,
  });

  sharedSocket.on('connect', () => {
    notifyStatus('connected');
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
      // Token may have expired — silently refresh, then let Socket.IO retry
      console.info('[Realtime] Auth token expired — attempting silent refresh before reconnect');
      trySilentTokenRefresh().then((refreshed) => {
        if (refreshed) {
          console.info('[Realtime] Token refreshed — reconnecting socket');
        } else {
          console.warn('[Realtime] Token refresh failed — socket will retry with existing credentials');
        }
        // Socket.IO reconnection loop will pick up the new cookie automatically on the next attempt
      });
    } else {
      console.warn('[Realtime] Socket connection error:', msg);
    }
    notifyStatus('error');
  });

  sharedSocket.on('disconnect', (reason) => {
    notifyStatus('disconnected');
    if (reason === 'io server disconnect') {
      // Reconnect manually if server disconnected
      sharedSocket.connect();
    }
  });

  // Listen to generic events
  sharedSocket.on('live-session-update', (data) => {
    const canonicalType = normalizeEventName(data.type || data.event);
    notifyEvent({ type: canonicalType, payload: data });
  });

  // Listen to canonical events
  Object.values(REALTIME_EVENTS).forEach((eventName) => {
    sharedSocket.on(eventName, (data) => {
      notifyEvent({ type: eventName, payload: data });
    });
  });
}

/**
 * RealtimeListener Component
 * Mounts in Context Providers (AdminContext, StaffContext, StudentContext) to receive updates.
 */
export default function RealtimeListener({ onUpdate, enableNotifications = false }) {
  const studentContext = useContext(StudentContext);
  const staffContext = useContext(StaffContext);
  const studentData = studentContext?.studentData;
  const currentStaff = staffContext?.staffData;

  const studentDataRef = useRef(studentData);
  const staffDataRef = useRef(currentStaff);
  const [_status, setStatus] = useState(sharedStatus);

  useEffect(() => {
    studentDataRef.current = studentData;
    staffDataRef.current = currentStaff;
  }, [studentData, currentStaff]);

  const handleNotification = useCallback((event, payload) => {
    const sData = studentDataRef.current;
    const stData = staffDataRef.current;
    const canonical = normalizeEventName(event);

    if (canonical === REALTIME_EVENTS.TIMETABLE_CHANGED) {
      if (sData?.branch === payload.branch || stData?.branch === payload.branch) {
        toast.success('Timetable has been updated!', { id: 'timetable-update' });
      }
    }

    if (canonical === REALTIME_EVENTS.SESSION_STARTED) {
      if (sData?.branch === payload.branch) {
        toast('🚀 New Attendance Session Started!', { icon: '📝', duration: 8000, id: payload.sessionId });
      }
    }

    if (canonical === REALTIME_EVENTS.REQUEST_CREATED || canonical === REALTIME_EVENTS.REQUEST_UPDATED) {
      if (stData && (payload.staffType === stData.role || payload.role === stData.role)) {
        toast(`New student request: ${payload.certificate_type || payload.type || 'Document'}`, { icon: '🔔' });
      }
      if (sData && (payload.student_id === sData.id || payload.roll_no === sData.roll_no)) {
        toast(`Request update: ${payload.certificate_type || payload.type || 'Request processed'}`, { icon: '📄' });
      }
    }

    if (canonical === REALTIME_EVENTS.ADMISSION_CREATED) {
      if (stData?.role === 'admission') {
        toast.success('New student admission draft received', { id: 'new-admission-draft' });
      }
    }

    if (canonical === REALTIME_EVENTS.STAFF_REGISTRATION_CREATED) {
      if (stData?.role === 'admin' || window.location.pathname.startsWith('/admin')) {
        toast('New staff registration pending approval', { icon: '👤', id: 'new-staff-reg' });
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

    ensureSocketConnection();

    return () => {
      statusSubscribers.delete(statusHandler);
      eventSubscribers.delete(eventHandler);
    };
  }, [enableNotifications, handleNotification, onUpdate]);

  return null;
}

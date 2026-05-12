'use client';

import { useEffect, useRef, useContext, useCallback, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import toast from 'react-hot-toast';
import { StudentContext } from '@/context/StudentContext';
import { ClerkContext } from '@/context/ClerkContext';

let sharedSupabaseClient = null;
let sharedChannel = null;
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

function getSharedSupabaseClient() {
  if (sharedSupabaseClient) return sharedSupabaseClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || typeof window === 'undefined') return null;

  sharedSupabaseClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });

  return sharedSupabaseClient;
}

function ensureRealtimeChannel() {
  if (sharedChannel) return;
  const supabase = getSharedSupabaseClient();
  if (!supabase) {
    notifyStatus('error');
    return;
  }

  sharedChannel = supabase.channel('kucet-updates', {
    config: {
      broadcast: { ack: true },
    },
  });

  sharedChannel
    .on('broadcast', { event: '*' }, ({ event, payload }) => {
      notifyEvent({ type: event, payload });
    })
    .subscribe((status) => {
      notifyStatus(status === 'SUBSCRIBED' ? 'connected' : status);
    });
}

export default function RealtimeListener({ onUpdate, showIndicator = false, enableNotifications = false }) {
  const { studentData } = useContext(StudentContext) || {};
  const { clerkData } = useContext(ClerkContext) || {};
  
  // Use refs to store the latest identity to avoid stale closure in notification logic
  const studentDataRef = useRef(studentData);
  const clerkDataRef = useRef(clerkData);
  
  const [status, setStatus] = useState(sharedStatus);
  const [debugInfo, setDebugInfo] = useState('');

  useEffect(() => {
    studentDataRef.current = studentData;
    clerkDataRef.current = clerkData;
  }, [studentData, clerkData]);

  const handleNotification = useCallback((event, payload) => {
    const sData = studentDataRef.current;
    const cData = clerkDataRef.current;

    console.log('📡 [Supabase Event]', event, payload);

    // 1. TIMETABLE UPDATES
    if (event === 'TIMETABLE_CHANGED') {
      if (sData?.branch === payload.branch) {
        toast.success('Your timetable has been updated!', { duration: 5000, id: 'timetable-update' });
      }
    }

    // 2. ATTENDANCE SESSIONS
    if (event === 'SESSION_STARTED') {
      if (sData?.branch === payload.branch) {
        toast('🚀 New Attendance Session Started!', { icon: '📝', duration: 10000, id: payload.sessionId });
      }
    }

    // 3. CERTIFICATE & PROFILE REQUESTS
    if (event === 'REQUEST_CREATED' || event === 'REQUEST_UPDATED') {
      // Logic for Clerk notifications (New requests for them to approve)
      if (cData && payload.clerkType === cData.role) {
         toast(`New request: ${payload.certificate_type}`, { icon: '🔔' });
      }
      // Logic for Student notifications (Status updates on their requests)
      if (sData && payload.student_id === sData.id) {
         toast(`Request status updated: ${payload.certificate_type}`, { icon: '📄' });
      }
    }
  }, []);

  useEffect(() => {
    const statusHandler = (nextStatus) => {
      setStatus(nextStatus);
      setDebugInfo(nextStatus);
    };
    const eventHandler = ({ type, payload }) => {
      if (typeof onUpdate === 'function') {
        onUpdate({ type, payload });
      }
      if (enableNotifications) {
        handleNotification(type, payload || {});
      }
    };

    statusSubscribers.add(statusHandler);
    eventSubscribers.add(eventHandler);
    statusHandler(sharedStatus);
    ensureRealtimeChannel();

    return () => {
      statusSubscribers.delete(statusHandler);
      eventSubscribers.delete(eventHandler);
    };
  }, [enableNotifications, handleNotification, onUpdate]);

  if (!showIndicator) return null;

  // Visual status indicator (minimal)
  return (
    <div className="fixed bottom-4 right-4 z-[9999] pointer-events-none flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-tighter border shadow-sm transition-all duration-500 backdrop-blur-xs ${
          status === 'connected' 
            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
            : 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse'
        }`}>
          <div className={`w-1 h-1 rounded-full ${status === 'connected' ? 'bg-emerald-500 shadow-[0_0_5px_#10b981]' : 'bg-amber-500'}`}></div>
          {status}
        </div>
        
        {debugInfo && (
          <div className="bg-slate-900/80 text-white/50 text-[7px] px-1.5 py-0.5 rounded backdrop-blur-xs uppercase tracking-widest font-bold border border-white/5">
            {debugInfo}
          </div>
        )}
      </div>
    </div>
  );
}

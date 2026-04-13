'use client';

import { useEffect, useRef, useContext, useCallback, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import toast from 'react-hot-toast';
import { StudentContext } from '@/context/StudentContext';
import { ClerkContext } from '@/context/ClerkContext';
import { showLocalNotification } from '@/lib/notification-utils';

// Create a single Supabase instance outside the component to avoid "Multiple GoTrueClient instances" warning.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase = null;
if (typeof window !== 'undefined' && supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false, 
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
}

export default function RealtimeListener() {
  const { studentData } = useContext(StudentContext) || {};
  const { clerkData } = useContext(ClerkContext) || {};
  
  const studentDataRef = useRef(studentData);
  const clerkDataRef = useRef(clerkData);
  
  const [status, setStatus] = useState('connecting');
  const [debugInfo, setDebugInfo] = useState('');

  useEffect(() => {
    studentDataRef.current = studentData;
    clerkDataRef.current = clerkData;
  }, [studentData, clerkData]);

  const handleNotification = useCallback((event, payload) => {
    const sData = studentDataRef.current;
    const cData = clerkDataRef.current;

    console.log('📡 [Supabase Event]', event, payload);

    if (event === 'TIMETABLE_CHANGED') {
      if (sData?.branch === payload.branch) {
        toast.success('Your timetable has been updated!', { duration: 5000, id: 'timetable-update' });
        showLocalNotification('Timetable Updated', 'Your departmental timetable has been changed.', { type: 'TIMETABLE' });
      }
    }

    if (event === 'SESSION_STARTED') {
      if (sData?.branch === payload.branch) {
        toast('🚀 New Attendance Session Started!', { icon: '📝', duration: 10000, id: payload.sessionId });
        showLocalNotification('Class Started', `Attendance is active for ${payload.subject_code}`, { type: 'SESSION', sessionId: payload.sessionId });
      }
    }

    if (event === 'REQUEST_CREATED' || event === 'REQUEST_UPDATED') {
      if (cData && payload.clerkType === cData.role) {
         toast(`New request: ${payload.certificate_type}`, { icon: '🔔' });
         showLocalNotification('New Request', `A new ${payload.certificate_type} needs approval.`, { type: 'CLERK_REQ' });
      }
      if (sData && payload.student_id === sData.id) {
         toast(`Request status updated: ${payload.certificate_type}`, { icon: '📄' });
         showLocalNotification('Request Update', `Your ${payload.certificate_type} status has been updated.`, { type: 'STUDENT_REQ' });
      }
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;

    let mounted = true;
    
    console.log('🔌 [Realtime] Connecting to channel...');
    const channel = supabase.channel('kucet-updates', {
      config: {
        broadcast: { ack: true },
      }
    });

    channel
      .on('broadcast', { event: '*' }, ({ event, payload }) => {
        if (mounted) handleNotification(event, payload);
      })
      .subscribe((status) => {
        if (!mounted) return;
        
        console.log('📶 [Realtime Status]:', status);
        setDebugInfo(status);
        
        if (status === 'SUBSCRIBED') {
          setStatus('connected');
        } else {
          // Supabase handles reconnections internally. 
          // We just update the UI status.
          setStatus('connecting');
        }
      });

    return () => {
      mounted = false;
      console.log('🔌 [Realtime] Cleaning up channel');
      supabase.removeChannel(channel);
    };
  }, [handleNotification]);

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

'use client';

import { useEffect, useRef, useContext, useCallback, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import toast from 'react-hot-toast';
import { StudentContext } from '@/context/StudentContext';
import { ClerkContext } from '@/context/ClerkContext';
import { showLocalNotification } from '@/lib/notification-utils';

// Singleton Supabase instance
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase = null;
if (typeof window !== 'undefined' && supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });
}

export default function RealtimeListener() {
  const { studentData } = useContext(StudentContext) || {};
  const { clerkData } = useContext(ClerkContext) || {};
  
  const studentDataRef = useRef(studentData);
  const clerkDataRef = useRef(clerkData);
  const retryCountRef = useRef(0);
  const maxRetries = 5;
  
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
    let channel = null;

    const subscribe = () => {
      if (!mounted) return;
      
      console.log('🔌 [Realtime] Connecting to channel...');
      channel = supabase.channel('kucet-updates');

      channel
        .on('broadcast', { event: '*' }, ({ event, payload }) => {
          if (mounted) handleNotification(event, payload);
        })
        .subscribe((currentStatus, err) => {
          if (!mounted) return;
          
          console.log('📶 [Realtime Status]:', currentStatus);
          setDebugInfo(currentStatus);
          
          if (currentStatus === 'SUBSCRIBED') {
            setStatus('connected');
            retryCountRef.current = 0; // Reset on success
          } else if (currentStatus === 'CHANNEL_ERROR') {
            setStatus('error');
            if (err) console.error('❌ [Realtime Error]:', err);
            
            // Limit retries to prevent flooding
            if (retryCountRef.current < maxRetries) {
              retryCountRef.current++;
              const delay = Math.pow(2, retryCountRef.current) * 1000;
              console.warn(`🔄 [Realtime] Channel error. Retrying in ${delay}ms... (Attempt ${retryCountRef.current}/${maxRetries})`);
              setTimeout(() => {
                if (mounted) {
                  supabase.removeChannel(channel);
                  subscribe();
                }
              }, delay);
            } else {
              console.error('🚫 [Realtime] Max retries reached. Real-time updates disabled. Check Supabase Dashboard.');
              setDebugInfo('MAX_RETRIES_REACHED');
            }
          } else if (currentStatus === 'TIMED_OUT') {
             setStatus('connecting');
          }
        });
    };

    subscribe();

    return () => {
      mounted = false;
      console.log('🔌 [Realtime] Cleaning up channel');
      if (channel) supabase.removeChannel(channel);
    };
  }, [handleNotification]);

  return (
    <div className="fixed bottom-4 right-4 z-[9999] pointer-events-none flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-tighter border shadow-sm transition-all duration-500 backdrop-blur-xs ${
          status === 'connected' 
            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
            : status === 'error' || status === 'missing-keys'
              ? 'bg-red-500/10 text-red-500 border-red-500/20'
              : 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse'
        }`}>
          <div className={`w-1 h-1 rounded-full ${
            status === 'connected' 
              ? 'bg-emerald-500 shadow-[0_0_5px_#10b981]' 
              : status === 'error' || status === 'missing-keys'
                ? 'bg-red-500'
                : 'bg-amber-500'
          }`}></div>
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

'use client';

import { useEffect, useRef, useContext, useCallback, useState } from 'react';
import { StudentContext } from '@/context/StudentContext';
import { ClerkContext } from '@/context/ClerkContext';
import { showLocalNotification } from '@/lib/notification-utils';

/**
 * Global Real-time Listener - AGGRESSIVE DEBUG VERSION
 */
export default function RealtimeListener({ onUpdate }) {
  const onUpdateRef = useRef(onUpdate);
  const studentCtx = useContext(StudentContext) || {};
  const clerkCtx = useContext(ClerkContext) || {};
  
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [debugInfo, setDebugInfo] = useState('Initializing...');

  const studentDataRef = useRef(studentCtx.studentData);
  const clerkDataRef = useRef(clerkCtx.clerkData);
  const internalStudentRef = useRef(null);
  const notifiedSessionsRef = useRef(new Set());

  useEffect(() => {
    studentDataRef.current = studentCtx.studentData;
    if (studentCtx.studentData) {
        const b = studentCtx.studentData.student?.branch || studentCtx.studentData.branch;
        if (typeof window !== 'undefined') window.__my_branch = b;
        setDebugInfo(`Logged in as: ${b}`);
    }
  }, [studentCtx.studentData]);

  useEffect(() => {
    clerkDataRef.current = clerkCtx.clerkData;
  }, [clerkCtx.clerkData]);
  
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const handleNotification = useCallback((data) => {
    const { type, payload } = data;
    if (type === 'CONNECTED') return; 
    
    const student = studentDataRef.current?.student || studentDataRef.current || internalStudentRef.current;
    
    console.log(`[Realtime-Notify] RECEIVED: ${type}. Payload Branch: ${payload?.branch}. My Branch: ${student?.branch}`);

    if (type === 'SESSION_STARTED') {
        const sessionId = payload.sessionId || payload.id;
        const targetBranch = String(payload.branch).trim().toUpperCase();
        const myBranch = String(student?.branch || 'UNKNOWN').trim().toUpperCase();

        // ALWAYS SHOW ALERT FOR DEBUGGING - NO FILTERS
        alert(`🔔 BROADCAST RECEIVED!\nSubject: ${payload.subject_code}\nTarget: ${targetBranch}\nDevice: ${myBranch}`);

        // If branches match, show the native notification
        if (targetBranch === myBranch || targetBranch === 'ALL') {
          showLocalNotification(
            'Attendance Started 📍',
            `Class for ${payload.subject_code} is live.`,
            { type: 'attendance', sessionId }
          );
        } else {
            console.warn('[Realtime] Branch mismatch prevented native notification');
        }
    } else if (type === 'SESSION_ENDED') {
        // alert('Attendance Session Ended');
    }
  }, []);

  // Catch-up and Identity
  useEffect(() => {
    const fetchIdentity = async () => {
      try {
        const res = await fetch('/api/student/me');
        if (res.ok) {
          const { roll_no } = await res.json();
          const profileRes = await fetch(`/api/student/${roll_no}`);
          if (profileRes.ok) {
            const data = await profileRes.json();
            internalStudentRef.current = data.student;
            const b = data.student.branch;
            if (typeof window !== 'undefined') window.__my_branch = b;
            setDebugInfo(`Identity Found: ${b}`);
          }
        }
      } catch (e) {
          setDebugInfo('Identity Fetch Error');
      }
    };
    
    if (!studentCtx.studentData && !clerkCtx.clerkData) {
      fetchIdentity();
    }
  }, [studentCtx.studentData, clerkCtx.clerkData]);

  useEffect(() => {
    const CHANNEL_NAME = 'kucet_sse_sync';
    const LOCK_NAME = 'kucet_sse_leader';
    let isLeader = false;
    let eventSource = null;
    let retryCount = 0;
    let lockResolver = null;
    let isUnmounted = false;

    const channel = new BroadcastChannel(CHANNEL_NAME);

    const broadcastStatus = (status) => {
        setConnectionStatus(status);
        if (typeof window !== 'undefined') {
            window.__sse_status = status;
            window.__sse_debug = debugInfo;
        }
        try { channel.postMessage({ type: 'STATUS_SYNC', status, debug: debugInfo }); } catch(e) {}
    };

    channel.onmessage = (event) => {
      if (event.data?.type === 'STATUS_QUERY') {
          channel.postMessage({ type: 'STATUS_SYNC', status: connectionStatus, debug: debugInfo });
          return;
      }
      if (event.data?.type === 'STATUS_SYNC') {
          if (!isLeader) {
              setConnectionStatus(event.data.status);
              setDebugInfo(event.data.debug);
          }
          return;
      }
      if (!isLeader) {
        handleNotification(event.data);
      }
    };

    const setupSSE = () => {
      if (isUnmounted) return;
      if (eventSource) eventSource.close();
      
      broadcastStatus('connecting');
      eventSource = new EventSource('/api/realtime/stream?t=' + Date.now());

      eventSource.onopen = () => {
        retryCount = 0;
        broadcastStatus('connected');
      };

      eventSource.onmessage = (event) => {
        try {
          if (event.data === ': ping' || !event.data) return;
          const data = JSON.parse(event.data);
          if (!data.type) return;

          if (data.type === 'CONNECTED') {
              broadcastStatus('connected');
              return;
          }

          if (isLeader) handleNotification(data);
          channel.postMessage(data);
        } catch (e) {
          console.error('[Realtime] Parse Error');
        }
      };

      eventSource.onerror = (err) => {
        broadcastStatus('error');
        eventSource.close();
        const delay = Math.min(30000, Math.pow(2, retryCount) * 1000);
        retryCount++;
        setTimeout(() => {
          if (isLeader && !isUnmounted) setupSSE();
        }, delay);
      };
    };

    if (typeof navigator !== 'undefined' && navigator.locks) {
      navigator.locks.request(LOCK_NAME, { mode: 'exclusive' }, () => {
        return new Promise((resolve) => {
          if (isUnmounted) { resolve(); return; }
          isLeader = true;
          lockResolver = resolve;
          setupSSE();
        });
      }).catch(e => {
        isLeader = false;
        channel.postMessage({ type: 'STATUS_QUERY' });
      });
    } else {
      isLeader = true;
      setupSSE();
    }

    return () => {
      isUnmounted = true;
      if (eventSource) eventSource.close();
      if (lockResolver) lockResolver();
      channel.close();
    };
  }, [handleNotification, debugInfo]); 

  return null;
}

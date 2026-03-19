'use client';

import { useEffect, useRef, useContext, useCallback, useState } from 'react';
import { StudentContext } from '@/context/StudentContext';
import { ClerkContext } from '@/context/ClerkContext';
import { showLocalNotification } from '@/lib/notification-utils';

/**
 * Global Real-time Listener
 * Handles SSE connection, tab multiplexing (leader election), and notifications.
 */
export default function RealtimeListener({ onUpdate }) {
  const onUpdateRef = useRef(onUpdate);
  const studentCtx = useContext(StudentContext) || {};
  const clerkCtx = useContext(ClerkContext) || {};
  
  const [internalStudent, setInternalStudent] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  // Use refs to avoid stale closures in the async leader election / SSE setup
  const studentDataRef = useRef(studentCtx.studentData);
  const clerkDataRef = useRef(clerkCtx.clerkData);

  useEffect(() => {
    studentDataRef.current = studentCtx.studentData;
  }, [studentCtx.studentData]);

  useEffect(() => {
    clerkDataRef.current = clerkCtx.clerkData;
  }, [clerkCtx.clerkData]);
  
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  // Fallback identity fetch if context isn't available (e.g., on landing page)
  useEffect(() => {
    const fetchIdentity = async () => {
      try {
        const res = await fetch('/api/student/me');
        if (res.ok) {
          const { roll_no } = await res.json();
          const profileRes = await fetch(`/api/student/${roll_no}`);
          if (profileRes.ok) {
            const data = await profileRes.json();
            setInternalStudent(data.student);
            console.log('[Realtime] Internal identity fetched:', data.student.branch);
            // Use a small alert once to confirm identity is loaded on phone
            // alert('Identity Loaded: ' + data.student.roll_no + ' (' + data.student.branch + ')');
          }
        }
      } catch (e) {
        console.error('[Realtime] Identity fetch failed');
      }
    };
    
    if (!studentCtx.studentData && !clerkCtx.clerkData) {
      fetchIdentity();
    }
  }, [studentCtx.studentData, clerkCtx.clerkData]);

  const handleNotification = useCallback((data) => {
    const { type, payload } = data;
    if (type === 'CONNECTED') return; 
    
    const student = studentDataRef.current?.student || studentDataRef.current || internalStudent;
    const clerk = clerkDataRef.current;

    console.log('[Realtime-Notify] Event:', type, 'Branch:', payload?.branch);

    if (student) {
      if (type === 'SESSION_STARTED') {
        // DIAGNOSTIC ALERT: Always show this to see if event reaches here
        alert(`EVENT: Session Started\nSubject: ${payload.subject_code}\nBranch: ${payload.branch}\nYour Branch: ${student.branch}`);

        if (payload.branch === student.branch) {
          showLocalNotification(
            'Attendance Session Started 📍',
            `A secure session for ${payload.subject_code} has started. Mark your attendance now!`,
            { type: 'attendance', sessionId: payload.sessionId }
          );
        }
      } else if (type === 'REQUEST_UPDATED') {
        if (payload.student_id === student.id) {
          const statusText = payload.status === 'APPROVED' ? 'Approved ✅' : 'Rejected ❌';
          showLocalNotification(
            `Certificate Request ${statusText}`,
            `Your request for ${payload.certificate_type} has been ${payload.status.toLowerCase()}.`,
            { type: 'certificate', requestId: payload.request_id }
          );
        }
      } else if (type === 'TIMETABLE_CHANGED') {
        if (payload.branch === student.branch) {
          showLocalNotification(
            'Timetable Updated 📅',
            `The timetable for Semester ${payload.semester} has been updated.`,
            { type: 'timetable', semester: payload.semester }
          );
        }
      }
    }

    if (clerk && clerk.id) {
      if (type === 'REQUEST_CREATED') {
        if (payload.clerkType === clerk.role) {
          showLocalNotification(
            'New Certificate Request 📄',
            `A new request for ${payload.certificateType} has been submitted.`,
            { type: 'clerk_request', clerkType: payload.clerkType }
          );
        }
      }
    }
  }, [internalStudent]);

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
        if (typeof window !== 'undefined') window.__sse_status = status;
        try {
            channel.postMessage({ type: 'STATUS_SYNC', status });
        } catch(e) {}
    };

    channel.onmessage = (event) => {
      if (event.data?.type === 'STATUS_QUERY') {
          channel.postMessage({ type: 'STATUS_SYNC', status: window.__sse_status || 'connecting' });
          return;
      }
      if (event.data?.type === 'STATUS_SYNC') {
          if (!isLeader) {
              setConnectionStatus(event.data.status);
              if (typeof window !== 'undefined') window.__sse_status = event.data.status;
          }
          return;
      }
      if (event.data?.type === 'FORCE_NOTIFY') {
          handleNotification(event.data.payload);
          return;
      }
      if (!isLeader) {
        if (onUpdateRef.current) onUpdateRef.current(event.data);
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

          if (isLeader) {
            handleNotification(data);
          }
          
          channel.postMessage(data);
          if (onUpdateRef.current) onUpdateRef.current(data);
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
          if (isUnmounted) {
            resolve();
            return;
          }
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
  }, [handleNotification]); 

  return null;
}

'use client';

import { useEffect, useRef, useContext, useCallback, useState } from 'react';
import { StudentContext } from '@/context/StudentContext';
import { ClerkContext } from '@/context/ClerkContext';
import { showLocalNotification } from '@/lib/notification-utils';

/**
 * Global Real-time Listener - Production Version
 * Handles SSE connection, leader election, and role-aware notifications.
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
  const notifiedSessionsRef = useRef(new Set()); // Prevents duplicate notifications

  // Sync refs with context updates
  useEffect(() => {
    studentDataRef.current = studentCtx.studentData;
    if (studentCtx.studentData) {
        const student = studentCtx.studentData.student || studentCtx.studentData;
        const b = student?.branch || student?.course;
        if (typeof window !== 'undefined') window.__my_branch = b;
        setDebugInfo(`Active: ${b}`);
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
    const clerk = clerkDataRef.current;

    console.log(`[Realtime-Event] ${type}`, payload);

    // --- STUDENT NOTIFICATIONS ---
    if (student) {
      if (type === 'SESSION_STARTED') {
        const sessionId = payload.sessionId || payload.id;
        if (!sessionId || notifiedSessionsRef.current.has(sessionId)) return;

        const targetBranch = String(payload.branch).trim().toUpperCase();
        const myBranch = String(student?.branch || student?.course || 'UNKNOWN').trim().toUpperCase();

        if (targetBranch === myBranch || targetBranch === 'ALL') {
          notifiedSessionsRef.current.add(sessionId);
          showLocalNotification(
            'Attendance Started 📍',
            `A secure session for ${payload.subject_code} is now active.`,
            { type: 'attendance', sessionId }
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
        const myBranch = String(student?.branch || student?.course || '').trim().toUpperCase();
        if (payload.branch?.toUpperCase() === myBranch) {
          showLocalNotification(
            'Timetable Updated 📅',
            `The schedule for Semester ${payload.semester} has been updated.`,
            { type: 'timetable', semester: payload.semester }
          );
        }
      }
    }

    // --- CLERK NOTIFICATIONS ---
    if (clerk && clerk.id) {
      if (type === 'REQUEST_CREATED' && payload.clerkType === clerk.role) {
          showLocalNotification(
            'New Request 📄',
            `A new ${payload.certificateType} application has been submitted.`,
            { type: 'clerk_request', clerkType: payload.clerkType }
          );
      }
    }
  }, []);

  // background identity resolution
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
            setDebugInfo(`Identity Resolved: ${b}`);
          }
        }
      } catch (e) {
          console.warn('[Realtime] Identity background fetch failed');
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

          if (isLeader) handleNotification(data);
          channel.postMessage(data);
          if (onUpdateRef.current) onUpdateRef.current(data);
        } catch (e) {
          console.error('[Realtime] Message Parse Error');
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
  }, [handleNotification, debugInfo, connectionStatus]); 

  return null;
}

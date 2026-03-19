'use client';

import { useEffect, useRef, useContext, useCallback } from 'react';
import { StudentContext } from '@/context/StudentContext';
import { ClerkContext } from '@/context/ClerkContext';
import { showLocalNotification } from '@/lib/notification-utils';

export default function RealtimeListener({ onUpdate }) {
  const onUpdateRef = useRef(onUpdate);
  const { studentData } = useContext(StudentContext) || {};
  const { clerkData } = useContext(ClerkContext) || {};
  
  // Use refs to avoid stale closures in the async leader election / SSE setup
  const studentDataRef = useRef(studentData);
  const clerkDataRef = useRef(clerkData);

  useEffect(() => {
    studentDataRef.current = studentData;
  }, [studentData]);

  useEffect(() => {
    clerkDataRef.current = clerkData;
  }, [clerkData]);
  
  // Keep the ref updated with the latest callback
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const handleNotification = useCallback((data) => {
    const { type, payload } = data;
    const currentStudentData = studentDataRef.current;
    const currentClerkData = clerkDataRef.current;

    // --- STUDENT NOTIFICATIONS ---
    const student = currentStudentData?.student || currentStudentData;
    if (student && student.id) {
      if (type === 'SESSION_STARTED') {
        // Notify if branch matches and student is in a matching year
        if (payload.branch === student.branch) {
          showLocalNotification(
            'Attendance Session Started 📍',
            `A secure session for ${payload.subject_code} has started. Mark your attendance now!`,
            { type: 'attendance', sessionId: payload.sessionId }
          );
        }
      } else if (type === 'REQUEST_UPDATED') {
        // Notify specific student about their certificate request
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

    // --- CLERK NOTIFICATIONS ---
    if (currentClerkData && currentClerkData.id) {
      if (type === 'REQUEST_CREATED') {
        // Notify relevant clerk type
        if (payload.clerkType === currentClerkData.role) {
          showLocalNotification(
            'New Certificate Request 📄',
            `A new request for ${payload.certificateType} has been submitted.`,
            { type: 'clerk_request', clerkType: payload.clerkType }
          );
        }
      } else if (type === 'PROFILE_UPDATE_REQUESTED') {
        if (currentClerkData.role === 'admission') {
          showLocalNotification(
            'New Profile Update Request 👤',
            'A student has requested a profile information update.',
            { type: 'profile_update' }
          );
        }
      }
    }
  }, []);

  useEffect(() => {
    const CHANNEL_NAME = 'kucet_sse_sync';
    const LOCK_NAME = 'kucet_sse_leader';
    let isLeader = false;
    let eventSource = null;
    let retryCount = 0;
    let lockResolver = null;
    let isUnmounted = false;

    // Cross-tab communication channel
    const channel = new BroadcastChannel(CHANNEL_NAME);

    // Follower tabs listen for updates broadcasted by the leader tab
    channel.onmessage = (event) => {
      if (!isLeader) {
        console.log('[Realtime-Follower] Received update via broadcast:', event.data.type);
        if (onUpdateRef.current) onUpdateRef.current(event.data);
      }
    };

    const setupSSE = () => {
      if (isUnmounted) return;
      if (eventSource) eventSource.close();
      
      console.log('[Realtime-Leader] Connecting to stream...');
      eventSource = new EventSource('/api/realtime/stream');

      eventSource.onopen = () => {
        console.log('[Realtime-Leader] Connected');
        retryCount = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          // Ignore keep-alive pings which might not be valid JSON
          if (event.data === ': ping' || !event.data) return;
          
          const data = JSON.parse(event.data);
          if (!data.type) return;

          console.log('[Realtime-Leader] Received update:', data.type);

          // 1. Trigger Local Notifications (ONLY for the Leader tab to avoid duplicates)
          if (isLeader) {
            handleNotification(data);
          }
          
          // 2. Broadcast to all other open tabs (Followers)
          channel.postMessage(data);
          
          // 3. Process locally in this tab (Leader)
          if (onUpdateRef.current) onUpdateRef.current(data);
        } catch (e) {
          // Silent catch for ping parse errors
        }
      };

      eventSource.onerror = (err) => {
        console.warn('[Realtime-Leader] Connection lost, retrying...');
        eventSource.close();
        
        // Exponential backoff with a cap of 30 seconds
        const delay = Math.min(30000, Math.pow(2, retryCount) * 1000);
        retryCount++;
        setTimeout(() => {
          // Only retry if we are still the leader and component is mounted
          if (isLeader && !isUnmounted) setupSSE();
        }, delay);
      };
    };

    // TAB MULTIPLEXING: Leader Election
    // Use Web Locks API to ensure only ONE tab ever opens the SSE connection.
    // This entirely bypasses the browser's 6-connection HTTP/1.1 limit.
    if (typeof navigator !== 'undefined' && navigator.locks) {
      navigator.locks.request(LOCK_NAME, { mode: 'exclusive' }, () => {
        return new Promise((resolve) => {
          if (isUnmounted) {
            resolve();
            return;
          }
          isLeader = true;
          lockResolver = resolve;
          console.log('[Realtime] Acquired leader lock. This tab handles the SSE connection for the browser.');
          setupSSE();
        });
      }).catch(e => {
        console.warn('[Realtime] Failed to acquire lock:', e);
      });
    } else {
      // Fallback for older browsers without Web Locks API support
      isLeader = true;
      setupSSE();
    }

    return () => {
      isUnmounted = true;
      if (eventSource) eventSource.close();
      if (lockResolver) lockResolver(); // Instantly release the lock so another tab takes over
      channel.close();
    };
  }, [handleNotification]); 

  return null; // Invisible utility component
}

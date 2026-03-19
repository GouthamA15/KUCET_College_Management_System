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
    if (studentData) {
        console.log('[Realtime] Student Data Context Updated:', studentData.student?.roll_no || studentData.roll_no);
    }
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

    console.log('[Realtime-Notify] Logic Triggered. Type:', type, 'Payload Branch:', payload?.branch);

    // --- STUDENT NOTIFICATIONS ---
    const student = currentStudentData?.student || currentStudentData;
    if (student) {
      console.log('[Realtime-Notify] Student Identity:', student.roll_no, 'Branch:', student.branch);
      
      if (type === 'SESSION_STARTED') {
        // ALERT FOR DEBUGGING: Does it even reach here?
        // alert('SSE: SESSION_STARTED received for branch ' + payload.branch);
        
        if (payload.branch === student.branch) {
          console.log('[Realtime-Notify] BRANCH MATCH! Showing native notification...');
          showLocalNotification(
            'Attendance Session Started 📍',
            `A secure session for ${payload.subject_code} has started. Mark your attendance now!`,
            { type: 'attendance', sessionId: payload.sessionId }
          );
        } else {
          console.log('[Realtime-Notify] Branch Mismatch. Payload:', payload.branch, 'Student:', student.branch);
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
    } else {
      console.log('[Realtime-Notify] No student data found in context. Ignoring event.');
    }

    // --- CLERK NOTIFICATIONS ---
    if (currentClerkData && currentClerkData.id) {
      if (type === 'REQUEST_CREATED') {
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

    const channel = new BroadcastChannel(CHANNEL_NAME);

    channel.onmessage = (event) => {
      if (!isLeader) {
        console.log('[Realtime-Follower] Received update via broadcast:', event.data.type);
        if (onUpdateRef.current) onUpdateRef.current(event.data);
        // followers also process notifications
        handleNotification(event.data);
      }
    };

    const setupSSE = () => {
      if (isUnmounted) return;
      if (eventSource) eventSource.close();
      
      console.log('[Realtime-Leader] Connecting to stream...');
      eventSource = new EventSource('/api/realtime/stream');

      eventSource.onopen = () => {
        console.log('[Realtime-Leader] SSE Stream Connected');
        retryCount = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          if (event.data === ': ping' || !event.data) return;
          
          const data = JSON.parse(event.data);
          if (!data.type) return;

          console.log('[Realtime-Leader] SSE Message Received:', data.type);

          if (isLeader) {
            handleNotification(data);
          }
          
          channel.postMessage(data);
          if (onUpdateRef.current) onUpdateRef.current(data);
        } catch (e) {
          console.error('[Realtime-Leader] Parse Error:', e);
        }
      };

      eventSource.onerror = (err) => {
        console.warn('[Realtime-Leader] SSE Connection Error, retrying...');
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
          console.log('[Realtime] ACQUIRED LEADER LOCK.');
          setupSSE();
        });
      }).catch(e => {
        console.warn('[Realtime] Lock failed, acting as follower:', e);
        isLeader = false;
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

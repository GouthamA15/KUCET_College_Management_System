'use client';

import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

export default function RealtimeListener({ onUpdate }) {
  const onUpdateRef = useRef(onUpdate);
  
  // Keep the ref updated with the latest callback
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

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
          
          // 1. Broadcast to all other open tabs (Followers)
          channel.postMessage(data);
          
          // 2. Process locally in this tab (Leader)
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
  }, []);

  return null; // Invisible utility component
}

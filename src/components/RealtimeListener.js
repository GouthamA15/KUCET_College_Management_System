'use client';

import { useEffect } from 'react';
import toast from 'react-hot-toast';

export default function RealtimeListener({ onUpdate }) {
  useEffect(() => {
    let eventSource = null;
    let retryCount = 0;
    const maxRetries = 5;

    const setupSSE = () => {
      if (eventSource) eventSource.close();
      
      console.log('[Realtime] Connecting to stream...');
      eventSource = new EventSource('/api/realtime/stream');

      eventSource.onopen = () => {
        console.log('[Realtime] Connected');
        retryCount = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[Realtime] Received update:', data.type);
          if (onUpdate) onUpdate(data);
        } catch (e) {
          // Likely keep-alive ping
        }
      };

      eventSource.onerror = (err) => {
        console.warn('[Realtime] Connection lost, retrying...');
        eventSource.close();
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(setupSSE, 3000 * retryCount);
        }
      };
    };

    setupSSE();
    return () => {
      if (eventSource) eventSource.close();
    };
  }, [onUpdate]);

  return null; // Invisible utility component
}

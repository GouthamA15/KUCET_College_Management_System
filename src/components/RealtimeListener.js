'use client';

import { useEffect } from 'react';
import toast from 'react-hot-toast';

export default function RealtimeListener({ onUpdate }) {
  useEffect(() => {
    let eventSource = null;
    let retryCount = 0;

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
        
        // Exponential backoff with a cap of 30 seconds
        const delay = Math.min(30000, Math.pow(2, retryCount) * 1000);
        retryCount++;
        setTimeout(setupSSE, delay);
      };
    };

    setupSSE();
    return () => {
      if (eventSource) eventSource.close();
    };
  }, [onUpdate]);

  return null; // Invisible utility component
}

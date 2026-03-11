import { addSSEClient, removeSSEClient } from '@/lib/sse';

export async function GET(req) {
  const stream = new ReadableStream({
    start(controller) {
      addSSEClient(controller);
      
      // Keep-alive ping every 15 seconds for aggressive proxies (Render)
      const interval = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(': ping\n\n'));
        } catch (e) {
          clearInterval(interval);
          removeSSEClient(controller);
        }
      }, 15000);

      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
        removeSSEClient(controller);
      });
    },
    cancel(controller) {
      removeSSEClient(controller);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Critical for Render/Nginx
    },
  });
}

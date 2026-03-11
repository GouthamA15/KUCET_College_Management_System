// SSE Client Manager
// Tracks active response controllers to broadcast real-time updates

if (!global._sse_controllers) {
  global._sse_controllers = new Set();
}

export function addSSEClient(controller) {
  global._sse_controllers.add(controller);
}

export function removeSSEClient(controller) {
  global._sse_controllers.delete(controller);
}

export function broadcastUpdate(type, payload = {}) {
  const message = `data: ${JSON.stringify({ type, payload, timestamp: Date.now() })}\n\n`;
  const encoder = new TextEncoder();
  
  console.log(`[SSE] Broadcasting ${type} to ${global._sse_controllers.size} clients`);
  
  global._sse_controllers.forEach(controller => {
    try {
      controller.enqueue(encoder.encode(message));
    } catch (e) {
      // Client likely disconnected
      global._sse_controllers.delete(controller);
    }
  });
}

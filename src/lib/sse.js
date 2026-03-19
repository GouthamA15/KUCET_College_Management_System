// SSE Client Manager (Memory-Based)
// 100% Free & Permanent: Tracks active response controllers in server RAM.
// Best for single-instance deployments (Render Free Tier).

if (!global._sse_controllers) {
  global._sse_controllers = new Set();
}

/**
 * Adds a new client connection to the local pool.
 */
export function addSSEClient(controller) {
  global._sse_controllers.add(controller);
  console.log(`[SSE] Client connected. Total active connections: ${global._sse_controllers.size}`);
}

const encoder = new TextEncoder();

/**
 * Broadcasts a message to all connected clients.
 * This runs entirely in server memory.
 */
export function broadcastUpdate(type, payload = {}) {
  const message = JSON.stringify({ type, payload, timestamp: Date.now() });
  const data = `data: ${message}\n\n`;
  const encoded = encoder.encode(data);
  
  console.log(`[SSE] Broadcasting ${type} to ${global._sse_controllers.size} clients.`);

  global._sse_controllers.forEach(controller => {
    try {
      controller.enqueue(encoded);
    } catch (e) {
      // Clean up dead connections
      global._sse_controllers.delete(controller);
    }
  });
}

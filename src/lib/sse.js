import Redis from 'ioredis';
import logger from '@/lib/logger';

// SSE Client Manager (Distributed via Redis Pub/Sub)
// Supports horizontal scaling by broadcasting events across multiple server instances.

const CH_SSE_UPDATES = 'kucet:sse:updates';
const encoder = new TextEncoder();

// Use Redis URL from env or construct from Rest URL if possible (though ioredis needs redis://)
const REDIS_URL = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL?.replace('https://', 'rediss://').replace('rest', 'default');

if (!global._sse_controllers) {
  global._sse_controllers = new Set();
}

/**
 * Global Redis Clients for Pub/Sub
 */
if (REDIS_URL && !global._redis_pub) {
  try {
    global._redis_pub = new Redis(REDIS_URL);
    global._redis_sub = new Redis(REDIS_URL);

    global._redis_sub.subscribe(CH_SSE_UPDATES, (err) => {
      if (err) {
        logger.error(err, '[SSE_REDIS_SUB_ERROR]');
      } else {
        logger.info('[SSE_REDIS_SUB] Subscribed to distributed updates.');
      }
    });

    global._redis_sub.on('message', (channel, message) => {
      if (channel === CH_SSE_UPDATES) {
        broadcastToLocalClients(message);
      }
    });
  } catch (err) {
    logger.error(err, '[SSE_REDIS_INIT_FAILURE] Falling back to memory-only SSE.');
  }
}

/**
 * Adds a new client connection to the local pool.
 */
export function addSSEClient(controller) {
  global._sse_controllers.add(controller);
  logger.info({ connections: global._sse_controllers.size }, '[SSE] Client connected');
}

/**
 * Removes a client connection from the pool.
 */
export function removeSSEClient(controller) {
  global._sse_controllers.delete(controller);
  logger.info({ connections: global._sse_controllers.size }, '[SSE] Client disconnected');
}

/**
 * Core internal function to push data to local clients only.
 */
function broadcastToLocalClients(jsonString) {
  const data = `data: ${jsonString}\n\n`;
  const encoded = encoder.encode(data);
  
  let deadControllers = [];
  global._sse_controllers.forEach(controller => {
    try {
      controller.enqueue(encoded);
    } catch (e) {
      deadControllers.push(controller);
    }
  });

  // Cleanup
  deadControllers.forEach(c => global._sse_controllers.delete(c));
}

/**
 * Broadcasts a message to ALL connected clients across ALL server instances.
 */
export async function broadcastUpdate(type, payload = {}) {
  const message = JSON.stringify({ type, payload, timestamp: Date.now() });

  // 1. If Redis is available, publish to the global channel
  if (global._redis_pub) {
    try {
      await global._redis_pub.publish(CH_SSE_UPDATES, message);
      return;
    } catch (err) {
      logger.error(err, '[SSE_REDIS_PUBLISH_FAILURE] Falling back to local broadcast');
    }
  }

  // 2. Fallback: Direct memory-based broadcast (for local dev or if Redis fails)
  broadcastToLocalClients(message);
}

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Redis = require('ioredis');
const { jwtVerify } = require('jose');

const app = express();
const server = http.createServer(app);

const socketHost = process.env.SOCKET_HOST || '0.0.0.0';
const socketPort = parseInt(process.env.SOCKET_PORT || '4000', 10);
const corsOrigin = process.env.CORS_ORIGIN || '*';
const jwtSecret = process.env.JWT_SECRET || 'temporary_secret_at_least_32_chars_long';
const secretKey = new TextEncoder().encode(jwtSecret);

// ---------------------------------------------------------------------------
// Socket.IO Server Configuration
// ---------------------------------------------------------------------------
const io = new Server(server, {
  cors: {
    origin: corsOrigin === '*' ? true : corsOrigin.split(','),
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 20000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
});

// ---------------------------------------------------------------------------
// Health Endpoint (Used by Docker & Uptime Kuma)
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'kucet-cms-realtime',
    uptimeSeconds: Math.round(process.uptime()),
    connectedSockets: io.engine ? io.engine.clientsCount : 0,
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Helper: Parse Cookies from Handshake Headers
// ---------------------------------------------------------------------------
function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts.shift()?.trim();
    if (name) {
      list[name] = decodeURIComponent(parts.join('=')?.trim());
    }
  });

  return list;
}

// ---------------------------------------------------------------------------
// JWT Authentication & Room Authorization Middleware
// ---------------------------------------------------------------------------
io.use(async (socket, next) => {
  try {
    const cookies = parseCookies(socket.handshake.headers.cookie);
    const authHeader = socket.handshake.auth?.token || socket.handshake.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;

    // Resolve candidate token from cookies or auth payload
    const token =
      cookies.admin_auth ||
      cookies.staff_auth ||
      cookies.student_auth ||
      bearerToken;

    if (!token) {
      // In development, allow anonymous read-only if explicitly enabled
      if (process.env.ALLOW_ANON_SOCKETS === 'true') {
        socket.user = { role: 'anonymous' };
        return next();
      }
      return next(new Error('Authentication required: Missing session credentials'));
    }

    // Verify JWT with jose
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    });

    socket.user = payload;
    return next();
  } catch (err) {
    console.warn(`[SocketAuth] Rejected connection attempt: ${err.message}`);
    return next(new Error('Authentication failed: Invalid or expired token'));
  }
});

// ---------------------------------------------------------------------------
// Socket Connection & Targeted Room Joining
// ---------------------------------------------------------------------------
io.on('connection', (socket) => {
  const user = socket.user || {};
  const role = user.role || 'unknown';

  // 1. Join user-specific rooms
  if (role === 'admin') {
    socket.join('role:admin');
    socket.join('channel:admissions');
    socket.join('channel:requests');
    socket.join('channel:staff');
    socket.join('channel:students');
    socket.join('channel:stats');
    if (user.id) socket.join(`user:admin:${user.id}`);
  } else if (role === 'student') {
    socket.join('role:student');
    if (user.student_id) socket.join(`user:student:${user.student_id}`);
    if (user.roll_no) socket.join(`student:${user.roll_no}`);
  } else {
    // Staff (Faculty, Admission Clerk, Scholarship Clerk)
    socket.join('role:staff');
    if (user.role) socket.join(`role:${user.role}`);
    if (user.id || user.staffId) socket.join(`user:staff:${user.id || user.staffId}`);
    if (user.branch) socket.join(`dept:${user.branch.toUpperCase()}`);

    if (user.role === 'admission') {
      socket.join('channel:admissions');
      socket.join('channel:requests');
    } else if (user.role === 'scholarship') {
      socket.join('channel:requests');
    }
  }

  // 2. Disconnect Handler
  socket.on('disconnect', (_reason) => {
    // Clean socket unmount
  });
});

// ---------------------------------------------------------------------------
// Redis Pub/Sub Event Ingress
// ---------------------------------------------------------------------------
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  retryStrategy(times) {
    return Math.min(times * 500, 5000);
  },
});

redis.on('connect', () => {
  console.info('[RedisPubSub] Connected to Redis for real-time ingress.');
});

redis.on('error', (err) => {
  console.error('[RedisPubSub] Redis connection error:', err.message);
});

// Subscribe to canonical and legacy channels
redis.subscribe('kucet:realtime:events', 'attendance-sync', (err, count) => {
  if (err) {
    console.error('[RedisPubSub] Failed to subscribe to channels:', err);
  } else {
    console.info(`[RedisPubSub] Subscribed to ${count} real-time channels.`);
  }
});

redis.on('message', (channel, message) => {
  try {
    const data = JSON.parse(message);
    const eventName = data.event || data.type || 'live-session-update';
    const rooms = data.rooms || (data.room ? [data.room] : []);

    if (rooms.length > 0) {
      rooms.forEach((room) => {
        io.to(room).emit(eventName, data);
        io.to(room).emit('live-session-update', data);
      });
    } else {
      // Broadcast to all authenticated connections
      io.emit(eventName, data);
      io.emit('live-session-update', data);
    }
  } catch (err) {
    console.error('[RedisPubSub] Failed to dispatch message:', err.message);
  }
});

// ---------------------------------------------------------------------------
// Server Startup & Graceful Shutdown
// ---------------------------------------------------------------------------
server.listen(socketPort, socketHost, () => {
  console.info(`✅ [KUCET Realtime] Socket.io service running on ${socketHost}:${socketPort}`);
});

function gracefulShutdown(signal) {
  console.info(`[KUCET Realtime] Received ${signal}. Closing server gracefully...`);
  io.close(() => {
    redis.quit(() => {
      server.close(() => {
        process.exit(0);
      });
    });
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Redis = require('ioredis');

const app = express();
const server = http.createServer(app);
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"]
  }
});

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Redis event handlers
redis.on('connect', () => {
  console.info('Redis connected');
});

redis.on('error', (err) => {
  console.error('Redis error:', err);
});

redis.on('end', () => {
  console.warn('Redis connection ended');
});

// Listen to Redis events from Next.js (Port 3000)
redis.subscribe('attendance-sync', (err) => {
  if (err) {
    console.error('Failed to subscribe to attendance-sync:', err);
  } else {
    console.info('Subscribed to attendance-sync channel');
  }
});

redis.on('message', (channel, message) => {
  if (channel === 'attendance-sync') {
    try {
      const data = JSON.parse(message);
      // Broadcast to all connected students
      io.emit('live-session-update', data);
    } catch (err) {
      console.error('Failed to parse message on channel', channel, ':', err);
      console.error('Raw message:', message);
    }
  }
});

const socketHost = process.env.SOCKET_HOST || '127.0.0.1';
const socketPort = parseInt(process.env.SOCKET_PORT || '4000', 10);

server.listen(socketPort, socketHost, () => {
  console.info(`Dedicated Socket.io Server running on ${socketHost}:${socketPort}`);
});

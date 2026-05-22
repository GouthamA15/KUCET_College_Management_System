const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Redis = require('ioredis');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://login.kucet.ac.in",
    methods: ["GET", "POST"]
  }
});

const redis = new Redis();

// Listen to Redis events from Next.js (Port 3000)
redis.subscribe('attendance-sync');
redis.on('message', (channel, message) => {
  if (channel === 'attendance-sync') {
    const data = JSON.parse(message);
    // Broadcast to all connected students
    io.emit('live-session-update', data);
  }
});

server.listen(4000, '127.0.0.1', () => {
  console.log('Dedicated Socket.io Server running on 127.0.0.1:4000');
});

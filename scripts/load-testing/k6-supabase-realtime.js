import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

/**
 * k6 WebSocket Load Test for Supabase Broadcast Realtime Features
 * Tests concurrent realtime broadcast throughput and latency for:
 * - room:attendance (GPS Proxy-free attendance verification)
 * - room:pulse (Live class pulse bar)
 */

export const options = {
  stages: [
    { duration: '30s', target: 50 },  // Ramp-up to 50 concurrent students
    { duration: '1m', target: 200 },  // Sustained load of 200 concurrent connections
    { duration: '30s', target: 500 },  // Stress peak to 500 users
    { duration: '30s', target: 0 },    // Ramp-down
  ],
  thresholds: {
    ws_connecting: ['p(95)<1000'],       // 95% connections established within 1 sec
    ws_session_duration: ['p(95)>10000'], // Sessions stay active
    'broadcast_latency': ['p(95)<250'],   // Realtime broadcast latency under 250ms
  },
};

const broadcastLatency = new Trend('broadcast_latency');
const broadcastFailures = new Counter('broadcast_failures');

export default function () {
  const supabaseUrl = __ENV.SUPABASE_URL || 'https://your-supabase-id.supabase.co';
  const anonKey = __ENV.SUPABASE_ANON_KEY || 'your-anon-key';

  // Construct Supabase Realtime WebSocket URL
  const wsHost = supabaseUrl.replace(/^http/, 'ws');
  const url = `${wsHost}/realtime/v1/websocket?apikey=${anonKey}&vsn=1.0.0`;

  const params = {
    headers: {
      'User-Agent': 'k6-load-test',
    },
  };

  const res = ws.connect(url, params, function (socket) {
    let joinRef = 1;
    let msgRef = 100;

    socket.on('open', function () {
      // 1. Join room:attendance broadcast channel
      socket.send(JSON.stringify({
        topic: 'realtime:room:attendance',
        event: 'phx_join',
        payload: { config: { broadcast: { self: true } } },
        ref: String(joinRef++),
      }));

      // 2. Join room:pulse broadcast channel
      socket.send(JSON.stringify({
        topic: 'realtime:room:pulse',
        event: 'phx_join',
        payload: { config: { broadcast: { self: true } } },
        ref: String(joinRef++),
      }));
    });

    socket.on('message', function (data) {
      try {
        const msg = JSON.parse(data);
        if (msg.event === 'broadcast') {
          const sentTime = msg.payload?.timestamp;
          if (sentTime) {
            const latency = Date.now() - sentTime;
            broadcastLatency.add(latency);
          }
        }
      } catch (_e) {
        broadcastFailures.add(1);
      }
    });

    // Periodically send broadcast pulse event every 3 seconds
    socket.setInterval(function () {
      const sendTime = Date.now();
      socket.send(JSON.stringify({
        topic: 'realtime:room:pulse',
        event: 'broadcast',
        payload: {
          type: 'BROADCAST',
          event: 'live_pulse',
          timestamp: sendTime,
          studentId: Math.floor(Math.random() * 1000) + 1,
          status: 'ACTIVE',
        },
        ref: String(msgRef++),
      }));
    }, 3000);

    // Keep connection alive for 30 seconds
    socket.setTimeout(function () {
      socket.close();
    }, 30000);

    socket.on('close', function () {
      // Clean disconnect
    });

    socket.on('error', function (e) {
      broadcastFailures.add(1);
      console.error('WebSocket Error:', e.error());
    });
  });

  check(res, { 'WebSocket connected successfully': (r) => r && r.status === 101 });
  sleep(1);
}

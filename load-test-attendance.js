import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * KUCET Attendance System - "Morning Rush" Load Test
 * Simulates 500 concurrent students marking attendance.
 * 
 * Usage:
 * 1. Install k6 (https://k6.io)
 * 2. Set BASE_URL and VALID_TOKEN env vars
 * 3. Run: k6 run load-test-attendance.js
 */

export const options = {
  stages: [
    { duration: '30s', target: 100 }, // Ramp up to 100 students
    { duration: '1m', target: 500 },  // High intensity: 500 students
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.01'],   // Error rate should be less than 1%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const STUDENT_AUTH_TOKEN = __ENV.VALID_TOKEN || 'YOUR_MOCK_JWT_TOKEN_HERE';

export default function () {
  const url = `${BASE_URL}/api/student/attendance/verify`;
  
  // Simulation Payload
  // Note: In a real test, you'd want to vary the student_id if using multiple tokens
  const payload = JSON.stringify({
    assignment_id: 1, // Assume a session exists for ID 1
    pin: '1234',      // The 4-digit session pin
    latitude: 17.969 + (Math.random() * 0.0001), // Near college
    longitude: 79.608 + (Math.random() * 0.0001),
    accuracy: 10,
    device_id: `mock-device-${Math.floor(Math.random() * 10000)}` // Unique device ID per VU
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `student_auth=${STUDENT_AUTH_TOKEN}`,
      'User-Agent': 'KUCET-Load-Tester/1.0'
    },
  };

  const res = http.post(url, payload, params);

  check(res, {
    'status is 200 or 403': (r) => r.status === 200 || r.status === 403,
    'duration < 500ms': (r) => r.timings.duration < 500,
  });

  // Wait a few seconds between retries to simulate student behavior
  sleep(1);
}

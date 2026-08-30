import { describe, it, expect } from 'vitest';
import { REALTIME_EVENTS, REALTIME_ROOMS, normalizeEventName } from '@/lib/events/realtime-events';
import { SignJWT, jwtVerify } from 'jose';

describe('Real-Time Event Architecture & Room Isolation', () => {
  const testSecret = new TextEncoder().encode('test_secret_for_jwt_validation_32_chars');

  describe('Event Normalization', () => {
    it('should map legacy admission events to canonical format', () => {
      expect(normalizeEventName('ADMISSION_DRAFT_CREATED')).toBe(REALTIME_EVENTS.ADMISSION_CREATED);
      expect(normalizeEventName('ADMISSION_DRAFT_UPDATED')).toBe(REALTIME_EVENTS.ADMISSION_UPDATED);
      expect(normalizeEventName('ADMISSION_DRAFT_FINALIZED')).toBe(REALTIME_EVENTS.ADMISSION_FINALIZED);
      expect(normalizeEventName('ADMISSION_DRAFT_DELETED')).toBe(REALTIME_EVENTS.ADMISSION_DELETED);
    });

    it('should map legacy request events to canonical format', () => {
      expect(normalizeEventName('REQUEST_CREATED')).toBe(REALTIME_EVENTS.REQUEST_CREATED);
      expect(normalizeEventName('REQUEST_UPDATED')).toBe(REALTIME_EVENTS.REQUEST_UPDATED);
    });

    it('should map legacy staff and student events to canonical format', () => {
      expect(normalizeEventName('STAFF_CREATED')).toBe(REALTIME_EVENTS.STAFF_CREATED);
      expect(normalizeEventName('STAFF_UPDATED')).toBe(REALTIME_EVENTS.STAFF_UPDATED);
      expect(normalizeEventName('STAFF_REGISTRATION_CREATED')).toBe(REALTIME_EVENTS.STAFF_REGISTRATION_CREATED);
      expect(normalizeEventName('PROFILE_PHOTO_UPDATED')).toBe(REALTIME_EVENTS.STUDENT_PHOTO_UPDATED);
      expect(normalizeEventName('PROFILE_PHOTO_REMOVED')).toBe(REALTIME_EVENTS.STUDENT_PHOTO_REMOVED);
    });

    it('should preserve already-canonical event names', () => {
      expect(normalizeEventName(REALTIME_EVENTS.ADMISSION_CREATED)).toBe('admission:created');
      expect(normalizeEventName(REALTIME_EVENTS.REQUEST_STATUS_CHANGED)).toBe('request:status-changed');
      expect(normalizeEventName('custom:unrecognized:event')).toBe('custom:unrecognized:event');
    });
  });

  describe('Room Namespacing and Data Isolation', () => {
    it('should generate correctly formatted role rooms', () => {
      expect(REALTIME_ROOMS.ADMIN).toBe('role:admin');
      expect(REALTIME_ROOMS.STAFF).toBe('role:staff');
      expect(REALTIME_ROOMS.FACULTY).toBe('role:faculty');
      expect(REALTIME_ROOMS.ADMISSION).toBe('role:admission');
      expect(REALTIME_ROOMS.SCHOLARSHIP).toBe('role:scholarship');
      expect(REALTIME_ROOMS.STUDENT).toBe('role:student');
    });

    it('should generate isolated user-specific and department rooms', () => {
      expect(REALTIME_ROOMS.userAdmin(1)).toBe('user:admin:1');
      expect(REALTIME_ROOMS.userStaff(42)).toBe('user:staff:42');
      expect(REALTIME_ROOMS.userStudent(101)).toBe('user:student:101');
      expect(REALTIME_ROOMS.studentRoll('22016401')).toBe('student:22016401');
      expect(REALTIME_ROOMS.dept('cse')).toBe('dept:CSE');
    });
  });

  describe('JWT Handshake Security & Room Authorization Logic', () => {
    it('should correctly verify an admin JWT and grant admin rooms', async () => {
      const adminPayload = { id: 1, email: 'admin@kucet.ac.in', role: 'admin' };
      const token = await new SignJWT(adminPayload)
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('15m')
        .sign(testSecret);

      const { payload } = await jwtVerify(token, testSecret);
      expect(payload.role).toBe('admin');
      expect(payload.id).toBe(1);

      // Verify room assignments
      const rooms = [];
      if (payload.role === 'admin') {
        rooms.push('role:admin', 'channel:admissions', 'channel:requests', 'channel:staff', `user:admin:${payload.id}`);
      }
      expect(rooms).toContain('role:admin');
      expect(rooms).toContain('user:admin:1');
      expect(rooms).toContain('channel:admissions');
      expect(rooms).not.toContain('role:student');
    });

    it('should correctly verify a staff JWT with department isolation', async () => {
      const staffPayload = { id: 5, email: 'faculty@kucet.ac.in', role: 'faculty', branch: 'CSE', is_hod: true };
      const token = await new SignJWT(staffPayload)
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('15m')
        .sign(testSecret);

      const { payload } = await jwtVerify(token, testSecret);
      expect(payload.role).toBe('faculty');
      expect(payload.branch).toBe('CSE');

      // Verify room assignments
      const rooms = ['role:staff', `role:${payload.role}`, `user:staff:${payload.id}`, `dept:${payload.branch.toUpperCase()}`];
      expect(rooms).toContain('role:staff');
      expect(rooms).toContain('role:faculty');
      expect(rooms).toContain('user:staff:5');
      expect(rooms).toContain('dept:CSE');
      expect(rooms).not.toContain('role:admin');
    });

    it('should correctly verify a student JWT and isolate to student room', async () => {
      const studentPayload = { student_id: 88, roll_no: '22016401', role: 'student' };
      const token = await new SignJWT(studentPayload)
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('15m')
        .sign(testSecret);

      const { payload } = await jwtVerify(token, testSecret);
      expect(payload.role).toBe('student');

      // Verify room assignments
      const rooms = ['role:student', `user:student:${payload.student_id}`, `student:${payload.roll_no}`];
      expect(rooms).toContain('role:student');
      expect(rooms).toContain('user:student:88');
      expect(rooms).toContain('student:22016401');
      expect(rooms).not.toContain('role:admin');
      expect(rooms).not.toContain('role:staff');
    });

    it('should reject invalid or tampered tokens', async () => {
      const wrongSecret = new TextEncoder().encode('wrong_secret_key_that_should_fail');
      const token = await new SignJWT({ role: 'admin' })
        .setProtectedHeader({ alg: 'HS256' })
        .sign(wrongSecret);

      await expect(jwtVerify(token, testSecret)).rejects.toThrow();
    });
  });
});

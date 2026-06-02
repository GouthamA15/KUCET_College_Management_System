import { describe, it, expect, vi, beforeEach } from 'vitest';
import SecurityService from '@/services/SecurityService';
import { db } from '@/db';
import { securityEvents, securityNotifications, userSessions } from '@/db/schema';
import { broadcastUpdate } from '@/lib/sse';
import { sendInstitutionalEmail } from '@/lib/email';

// Mock dependencies
vi.mock('@/db', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue([{ insertId: 1 }]),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ affectedRows: 1 }]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    query: {
      students: { findFirst: vi.fn() },
      clerks: { findFirst: vi.fn() },
      principal: { findFirst: vi.fn() },
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/clock', () => ({
  getNow: vi.fn(() => new Date('2026-06-02T10:00:00Z')),
}));

vi.mock('@/lib/sse', () => ({
  broadcastUpdate: vi.fn(),
}));

vi.mock('@/lib/email', () => ({
  sendInstitutionalEmail: vi.fn(),
  getBaseUrl: vi.fn(() => 'http://localhost'),
}));

describe('SecurityService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logEvent', () => {
    it('should insert a security event', async () => {
      await SecurityService.logEvent({
        userType: 'student',
        userId: 1,
        eventType: 'LOGIN',
        ipAddress: '1.2.3.4'
      });
      expect(db.insert).toHaveBeenCalledWith(securityEvents);
    });

    it('should handle log failure', async () => {
      db.insert.mockImplementationOnce(() => { throw new Error('Fail'); });
      await SecurityService.logEvent({ userType: 'student' });
      const logger = (await import('@/lib/logger')).default;
      expect(logger.error).toHaveBeenCalledWith(expect.any(Error), '[SECURITY_EVENT_LOG_FAILED]');
    });
  });

  describe('updateLastLogin', () => {
    it('should update student last login', async () => {
      await SecurityService.updateLastLogin('student', 1, '1.2.3.4');
      expect(db.update).toHaveBeenCalled();
    });

    it('should update clerk last login', async () => {
      await SecurityService.updateLastLogin('clerk', 1, '1.2.3.4');
      expect(db.update).toHaveBeenCalled();
    });

    it('should update admin last login', async () => {
      await SecurityService.updateLastLogin('admin', 1, '1.2.3.4');
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('createNotification', () => {
    it('should insert notification and broadcast', async () => {
      await SecurityService.createNotification({
        userType: 'student',
        userId: 1,
        title: 'Alert',
        message: 'Msg'
      });
      expect(db.insert).toHaveBeenCalledWith(securityNotifications);
      expect(broadcastUpdate).toHaveBeenCalledWith('SECURITY_NOTIFICATION_CREATED', expect.anything());
    });
  });

  describe('getActiveSessions', () => {
    it('should return mapped sessions', async () => {
      const mockSessions = [{ id: 1, device_name: 'PC', last_seen_at: new Date() }];
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            orderBy: vi.fn().mockResolvedValueOnce(mockSessions)
          })
        })
      });

      const result = await SecurityService.getActiveSessions('student', 1);
      expect(result).toHaveLength(1);
      expect(result[0].deviceName).toBe('PC');
    });
  });

  describe('revokeSession', () => {
    it('should revoke and notify', async () => {
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([{ id: 1, device_name: 'PC', browser: 'Chrome' }])
          })
        })
      });

      await SecurityService.revokeSession(1, 1, 'STUDENT');
      expect(db.update).toHaveBeenCalledWith(userSessions);
    });

    it('should return false if session not found', async () => {
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([])
          })
        })
      });
      const result = await SecurityService.revokeSession(1, 1, 'STUDENT');
      expect(result).toBe(false);
    });
  });

  describe('revokeOtherSessions', () => {
    it('should revoke all except current', async () => {
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([{ id: 2, device_name: 'Mobile' }])
        })
      });
      await SecurityService.revokeOtherSessions(1, 1, 'STUDENT');
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('detectNewDevice', () => {
    it('should return true for new device', async () => {
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([])
          })
        })
      });
      const result = await SecurityService.detectNewDevice(1, 'STUDENT', { browser: 'Opera', operatingSystem: 'Linux' }, '1.1.1.1');
      expect(result).toBe(true);
    });
  });

  describe('registerSession', () => {
    it('should register a new session', async () => {
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 1 }])
          })
        })
      });

      const result = await SecurityService.registerSession({
        userId: 1,
        userType: 'STUDENT',
        sessionToken: 'token',
        ipAddress: '1.2.3.4',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
      });
      expect(result).toBe(1);
      expect(db.insert).toHaveBeenCalledWith(userSessions);
    });
  });

  describe('sendSecurityEmail', () => {
    it('should handle all critical event types', async () => {
      db.query.students.findFirst.mockResolvedValue({ email: 's@t.com', name: 'S' });
      const events = ['NEW_DEVICE_LOGIN', 'PASSWORD_CHANGED', 'EMAIL_CHANGED', 'SESSION_REVOKED', 'OTHER_SESSIONS_REVOKED'];
      
      for (const event of events) {
        await SecurityService.sendSecurityEmail(event, 1, 'STUDENT', { browser: 'Chrome' }, '1.2.3.4');
      }
      expect(sendInstitutionalEmail).toHaveBeenCalledTimes(events.length);
    });
  });

  describe('updateSession', () => {
    it('should update session activity', async () => {
      const result = await SecurityService.updateSession({
        sessionId: 1,
        newToken: 'new-token',
        ipAddress: '1.2.3.4',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
      });
      expect(result).toBe(true);
      expect(db.update).toHaveBeenCalledWith(userSessions);
    });

    it('should handle update failure', async () => {
      db.update.mockImplementationOnce(() => { throw new Error('Update fail'); });
      const result = await SecurityService.updateSession({ sessionId: 1, newToken: 't', userAgent: '' });
      expect(result).toBe(false);
    });
  });

  describe('Error Cases', () => {
    it('should handle registerSession failure', async () => {
      db.insert.mockImplementationOnce(() => { throw new Error('Insert fail'); });
      const result = await SecurityService.registerSession({ userId: 1, userType: 'STUDENT', sessionToken: 't', userAgent: '' });
      expect(result).toBeUndefined();
    });

    it('should handle revokeOtherSessions error', async () => {
      db.select.mockImplementationOnce(() => { throw new Error('Select fail'); });
      const result = await SecurityService.revokeOtherSessions(1, 1, 'STUDENT');
      expect(result).toBe(false);
    });
  });
});

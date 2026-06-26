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
    runWithContext: vi.fn((ctx, cb) => cb()),
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
        userType: 'clerk',
        userId: 1,
        eventType: 'LOGIN',
        ipAddress: '1.2.3.4'
      });
      expect(db.insert).toHaveBeenCalledWith(securityEvents);
    });

    it('should handle log failure', async () => {
      db.insert.mockImplementationOnce(() => { throw new Error('Fail'); });
      await SecurityService.logEvent({ userType: 'clerk' });
      const logger = (await import('@/lib/logger')).default;
      expect(logger.error).toHaveBeenCalledWith(expect.any(Error), '[SECURITY_EVENT_LOG_FAILED]');
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login for all user types', async () => {
      await SecurityService.updateLastLogin('student', 1, '1.2.3.4');
      await SecurityService.updateLastLogin('clerk', 1, '1.2.3.4');
      await SecurityService.updateLastLogin('admin', 1, '1.2.3.4');
      expect(db.update).toHaveBeenCalledTimes(3);
    });
  });

  describe('createNotification', () => {
    it('should insert notification and broadcast', async () => {
      await SecurityService.createNotification({
        userType: 'clerk',
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

    it('should handle CLERK and ADMIN revocation', async () => {
        db.select.mockReturnValue({ from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ id: 1 }]) });
        await SecurityService.revokeSession(1, 1, 'CLERK');
        await SecurityService.revokeSession(1, 1, 'ADMIN');
        expect(db.update).toHaveBeenCalledTimes(2);
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

    it('should handle token hash variant', async () => {
        db.select.mockReturnValueOnce({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([{ id: 2 }]) });
        await SecurityService.revokeOtherSessions('STUDENT', 1, 'hash');
        expect(db.update).toHaveBeenCalled();
    });
  });

  describe('detectNewDevice', () => {
    it('should return true if no session with same characteristics found', async () => {
        db.select.mockReturnValueOnce({
            from: vi.fn().mockReturnValueOnce({
              where: vi.fn().mockReturnValueOnce({
                limit: vi.fn().mockResolvedValueOnce([])
              })
            })
          });
          const isNew = await SecurityService.detectNewDevice(1, 'CLERK', { browser: 'Firefox', operatingSystem: 'Windows' });
          expect(isNew).toBe(true);
    });

    it('should return false if matching session exists', async () => {
        db.select.mockReturnValueOnce({
            from: vi.fn().mockReturnValueOnce({
              where: vi.fn().mockReturnValueOnce({
                limit: vi.fn().mockResolvedValueOnce([{ id: 1 }])
              })
            })
          });
          const isNew = await SecurityService.detectNewDevice(1, 'CLERK', { browser: 'Chrome', operatingSystem: 'Windows' });
          expect(isNew).toBe(false);
    });
  });

  describe('registerSession', () => {
    it('should register a new session with default expiry', async () => {
      db.select.mockReturnValue({ from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ id: 1 }]) });
      const result = await SecurityService.registerSession({ userId: 1, userType: 'CLERK', sessionToken: 't', ipAddress: '1', userAgent: 'Chrome' });
      expect(result).toBe(1);
    });

    it('should register a new session with custom expiry', async () => {
        db.select.mockReturnValue({ from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ id: 1 }]) });
        const expiresAt = new Date(Date.now() + 10000).toISOString();
        await SecurityService.registerSession({ userId: 1, userType: 'CLERK', sessionToken: 't', ipAddress: '1', userAgent: 'Chrome', expiresAt });
        expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('sendSecurityEmail', () => {
    it('should handle all user types', async () => {
      db.query.students.findFirst.mockResolvedValue({ email: 's@t.com', name: 'S' });
      db.query.clerks.findFirst.mockResolvedValue({ email: 'c@t.com', name: 'C' });
      db.query.principal.findFirst.mockResolvedValue({ email: 'p@t.com', name: 'P' });

      await SecurityService.sendSecurityEmail('NEW_DEVICE_LOGIN', 1, 'STUDENT', { browser: 'Chrome' }, '1.2.3.4');
      await SecurityService.sendSecurityEmail('PASSWORD_CHANGED', 1, 'CLERK', {}, '1.2.3.4');
      await SecurityService.sendSecurityEmail('EMAIL_CHANGED', 1, 'ADMIN', {}, '1.2.3.4');
      
      expect(sendInstitutionalEmail).toHaveBeenCalledTimes(3);
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

    it('should update with custom expiry', async () => {
        const expiresAt = new Date(Date.now() + 10000).toISOString();
        const result = await SecurityService.updateSession({
          sessionId: 1,
          newToken: 'new-token',
          ipAddress: '1.2.3.4',
          userAgent: 'Chrome',
          expiresAt
        });
        expect(result).toBe(true);
      });

    it('should update if session ownership matches', async () => {
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([{ user_id: 42, user_type: 'CLERK' }])
          })
        })
      });
      const result = await SecurityService.updateSession({
        sessionId: 1,
        newToken: 'new-token',
        ipAddress: '1.2.3.4',
        userAgent: 'Chrome',
        userId: 42,
        userType: 'CLERK'
      });
      expect(result).toBe(true);
      expect(db.update).toHaveBeenCalledWith(userSessions);
    });

    it('should register new session if ownership mismatches', async () => {
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([{ user_id: 42, user_type: 'CLERK' }])
          })
        })
      });
      db.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValueOnce([{ insertId: 99 }])
      });

      const result = await SecurityService.updateSession({
        sessionId: 1,
        newToken: 'new-token',
        ipAddress: '1.2.3.4',
        userAgent: 'Chrome',
        userId: 43,
        userType: 'CLERK'
      });
      expect(result).toBe(99);
    });

    it('should handle update failure', async () => {
      db.update.mockImplementationOnce(() => { throw new Error('Update fail'); });
      const result = await SecurityService.updateSession({ sessionId: 1, newToken: 't', userAgent: '' });
      expect(result).toBe(false);
    });
  });
});

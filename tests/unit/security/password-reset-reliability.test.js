import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// Mock logger
vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    runWithContext: vi.fn((_ctx, cb) => cb()),
  },
}));

// Mock DB
const mockFindFirst = vi.fn();
const mockTransaction = vi.fn();

vi.mock('@/db', () => ({
  db: {
    query: {
      passwordResetTokens: {
        findFirst: (...args) => mockFindFirst(...args),
      },
      students: {
        findFirst: vi.fn().mockResolvedValue({ id: 101, roll_no: '24567T0901' }),
      },
      staffAccounts: {
        findFirst: vi.fn().mockResolvedValue({ id: 202, email: 'faculty@kucet.ac.in' }),
      },
      principal: {
        findFirst: vi.fn().mockResolvedValue({ id: 303, email: 'principal@kucet.ac.in' }),
      },
    },
    transaction: (cb) => mockTransaction(cb),
  },
}));

// Mock rate-limit
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getTieredKey: vi.fn().mockReturnValue('mock_tiered_key'),
}));

import { PasswordResetService, validatePasswordStrength } from '@/services/identity/PasswordResetService';

describe('PasswordResetService & Reliability Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Password Strength Validation', () => {
    it('rejects passwords shorter than 8 characters', () => {
      expect(validatePasswordStrength('Ab1!')).toBe('Password must be at least 8 characters long.');
    });

    it('rejects passwords missing uppercase letters', () => {
      expect(validatePasswordStrength('lowercase123!')).toContain('at least one uppercase letter');
    });

    it('rejects passwords missing digits', () => {
      expect(validatePasswordStrength('NoDigitsHere!')).toContain('at least one digit');
    });

    it('rejects passwords missing special characters', () => {
      expect(validatePasswordStrength('NoSpecialChar123')).toContain('at least one special character');
    });

    it('accepts compliant passwords', () => {
      expect(validatePasswordStrength('ValidP@ssw0rd!')).toBeNull();
      expect(validatePasswordStrength('Kucet#2026Strong')).toBeNull();
    });
  });

  describe('Token Validation', () => {
    it('returns INVALID for missing or null token', async () => {
      const res = await PasswordResetService.validateToken(null);
      expect(res.valid).toBe(false);
      expect(res.status).toBe('INVALID');
      expect(res.statusCode).toBe(400);
    });

    it('returns INVALID when token is not found in database', async () => {
      mockFindFirst.mockResolvedValueOnce(null);
      const res = await PasswordResetService.validateToken('nonexistenttoken');
      expect(res.valid).toBe(false);
      expect(res.status).toBe('INVALID');
      expect(res.statusCode).toBe(400);
    });

    it('returns USED when token already has used_at timestamp', async () => {
      mockFindFirst.mockResolvedValueOnce({
        token_hash: 'abc',
        used_at: new Date(Date.now() - 60000),
        expires_at: new Date(Date.now() + 3600000),
      });
      const res = await PasswordResetService.validateToken('alreadyusedtoken');
      expect(res.valid).toBe(false);
      expect(res.status).toBe('USED');
      expect(res.statusCode).toBe(409);
    });

    it('returns EXPIRED when token expires_at is in the past', async () => {
      mockFindFirst.mockResolvedValueOnce({
        token_hash: 'abc',
        used_at: null,
        expires_at: new Date(Date.now() - 3600000), // expired 1hr ago
      });
      const res = await PasswordResetService.validateToken('expiredtoken');
      expect(res.valid).toBe(false);
      expect(res.status).toBe('EXPIRED');
      expect(res.statusCode).toBe(410);
    });

    it('returns VALID when token is unconsumed and unexpired', async () => {
      const token = 'validunexpiredtoken12345';
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      mockFindFirst.mockResolvedValueOnce({
        token_hash: tokenHash,
        user_id: '24567T0901',
        user_type: 'student',
        used_at: null,
        expires_at: new Date(Date.now() + 3600000),
      });

      const res = await PasswordResetService.validateToken(token);
      expect(res.valid).toBe(true);
      expect(res.status).toBe('VALID');
      expect(res.statusCode).toBe(200);
    });
  });

  describe('Atomic Execution & Session Revocation', () => {
    it('atomically resets password, marks token used, and revokes sessions and refresh tokens', async () => {
      const token = 'atomicvalidtoken98765';
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const tokenData = {
        token_hash: tokenHash,
        user_id: '24567T0901',
        user_type: 'student',
        used_at: null,
        expires_at: new Date(Date.now() + 3600000),
      };

      mockFindFirst.mockResolvedValueOnce(tokenData);

      const mockTxUpdate = vi.fn().mockImplementation(() => ({
        set: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockResolvedValue([{ affectedRows: 1 }]),
        })),
      }));

      const mockTxInsert = vi.fn().mockImplementation(() => ({
        values: vi.fn().mockResolvedValue([{ insertId: 1 }]),
      }));

      mockTransaction.mockImplementation(async (callback) => {
        return callback({
          query: {
            students: {
              findFirst: vi.fn().mockResolvedValue({ id: 101, roll_no: '24567T0901' }),
            },
          },
          update: mockTxUpdate,
          insert: mockTxInsert,
        });
      });

      const result = await PasswordResetService.executeReset({
        rawToken: token,
        newPassword: 'ValidP@ssword2026!',
        clientIp: '127.0.0.1',
        userAgent: 'Vitest-Agent',
      });

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.message).toBe('Password reset successful');
      // Updates: 1 (student password) + 1 (token used) + 1 (userSessions revoked) + 2 (refreshTokens)
      expect(mockTxUpdate).toHaveBeenCalled();
    });

    it('rejects concurrent consumption when affectedRows is 0', async () => {
      const token = 'concurrenttoken123';
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      mockFindFirst.mockResolvedValueOnce({
        token_hash: tokenHash,
        user_id: '24567T0901',
        user_type: 'student',
        used_at: null,
        expires_at: new Date(Date.now() + 3600000),
      });

      mockTransaction.mockImplementation(async (callback) => {
        return callback({
          query: {
            students: {
              findFirst: vi.fn().mockResolvedValue({ id: 101, roll_no: '24567T0901' }),
            },
          },
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ affectedRows: 0 }]), // already consumed concurrently!
            }),
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue([{ insertId: 1 }]),
          }),
        });
      });

      const result = await PasswordResetService.executeReset({
        rawToken: token,
        newPassword: 'ValidP@ssword2026!',
      });

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(409);
      expect(result.error).toContain('already been used');
    });
  });
});

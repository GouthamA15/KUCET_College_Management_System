import { describe, it, expect, vi, beforeEach } from 'vitest';
import IdempotencyService from '@/services/IdempotencyService';
import { db } from '@/db';
import { idempotencyKeys } from '@/db/schema';

vi.mock('@/db', () => ({
  db: {
    query: {
      idempotencyKeys: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue([{ insertId: 1 }]),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{ affectedRows: 1 }]),
      })),
    })),
  },
}));

vi.mock('@/lib/clock', () => ({
  getNow: vi.fn(() => new Date('2026-06-02T10:00:00Z')),
}));

describe('IdempotencyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('start', () => {
    it('should return isDuplicate: false if no key provided', async () => {
      const result = await IdempotencyService.start(null);
      expect(result.isDuplicate).toBe(false);
    });

    it('should insert new key if not exists', async () => {
      db.query.idempotencyKeys.findFirst.mockResolvedValue(null);
      const result = await IdempotencyService.start('test-key');
      
      expect(result.isDuplicate).toBe(false);
      expect(db.insert).toHaveBeenCalledWith(idempotencyKeys);
    });

    it('should return isDuplicate: true if COMPLETED', async () => {
      db.query.idempotencyKeys.findFirst.mockResolvedValue({
        status: 'COMPLETED',
        response_body: { success: true },
        response_code: 201
      });
      
      const result = await IdempotencyService.start('test-key');
      expect(result.isDuplicate).toBe(true);
      expect(result.response).toEqual({ success: true });
      expect(result.code).toBe(201);
    });

    it('should throw error if STARTED and not expired', async () => {
      db.query.idempotencyKeys.findFirst.mockResolvedValue({
        status: 'STARTED',
        expires_at: new Date('2026-06-02T11:00:00Z') // After mock "now"
      });
      
      await expect(IdempotencyService.start('test-key')).rejects.toThrow('Transaction already in progress');
    });

    it('should update and reset if existing key is FAILED or expired', async () => {
      db.query.idempotencyKeys.findFirst.mockResolvedValue({
        id: 1,
        status: 'FAILED',
        expires_at: new Date('2026-06-01T10:00:00Z')
      });
      
      const result = await IdempotencyService.start('test-key');
      expect(result.isDuplicate).toBe(false);
      expect(result.isDuplicate).toBe(false);
      expect(db.update).toHaveBeenCalled();
    });

    it('should return duplicate if update affectedRows is 0 (race condition lost)', async () => {
      db.query.idempotencyKeys.findFirst.mockResolvedValue({
        id: 1,
        status: 'FAILED',
        response_body: { old: 'data' },
        expires_at: new Date('2026-06-01T10:00:00Z')
      });
      db.update.mockReturnValueOnce({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ affectedRows: 0 }]),
        })),
      });
      
      const result = await IdempotencyService.start('test-key');
      expect(result.isDuplicate).toBe(true);
      expect(result.response).toEqual({ old: 'data' });
    });

    it('should handle ER_DUP_ENTRY on insert correctly', async () => {
      db.query.idempotencyKeys.findFirst.mockResolvedValue(null);
      db.insert.mockImplementationOnce(() => {
        const err = new Error();
        err.code = 'ER_DUP_ENTRY';
        throw err;
      });
      
      await expect(IdempotencyService.start('test-key')).rejects.toThrow('Transaction already in progress');
    });

    it('should throw generic errors during insert', async () => {
      db.query.idempotencyKeys.findFirst.mockResolvedValue(null);
      db.insert.mockImplementationOnce(() => {
        throw new Error('Database Error');
      });
      
      await expect(IdempotencyService.start('test-key')).rejects.toThrow('Database Error');
    });
  });

  describe('complete', () => {
    it('should update status to COMPLETED', async () => {
      await IdempotencyService.complete('test-key', 200, { data: 'ok' });
      expect(db.update).toHaveBeenCalledWith(idempotencyKeys);
    });
  });

  describe('fail', () => {
    it('should update status to FAILED', async () => {
      await IdempotencyService.fail('test-key');
      expect(db.update).toHaveBeenCalledWith(idempotencyKeys);
    });
  });
});

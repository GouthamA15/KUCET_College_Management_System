import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FinanceService } from '@/services/FinanceService';
import { db } from '@/db';
import { studentFeePayments, studentRequests, scholarshipSanctions, students } from '@/db/schema';
import { eq, sql, and, gte, lte } from 'drizzle-orm';

// Mock dependencies
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock drizzle-orm
vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual('drizzle-orm');
  return {
    ...actual,
    sql: vi.fn((strings, ...values) => ({ strings, values })),
  };
});

describe('FinanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getFinancialStats', () => {
    it('should calculate financial stats correctly without filters', async () => {
      const mockFeeRes = [{ totalFees: '1000.50' }];
      const mockCertRes = [{ totalCertFees: '500.00' }];
      const mockSchRes = [{ totalSanctioned: '2000.00', totalReleased: '1500.00' }];

      const createMockQuery = (resolvedValue) => ({
        where: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) => resolve(resolvedValue)),
      });

      const sharedMock = {
        from: vi.fn()
          .mockReturnValueOnce(createMockQuery(mockFeeRes))
          .mockReturnValueOnce(createMockQuery(mockCertRes))
          .mockReturnValueOnce(createMockQuery(mockSchRes)),
      };

      db.select.mockReturnValue(sharedMock);

      const stats = await FinanceService.getFinancialStats();

      expect(stats).toEqual({
        totalFees: 1000.50,
        totalCertFees: 500.00,
        totalScholarshipSanctioned: 2000.00,
        totalScholarshipReleased: 1500.00,
        totalRevenue: 1500.50
      });
      expect(db.select).toHaveBeenCalledTimes(3);
    });

    it('should apply startDate and endDate filters correctly', async () => {
      const mockResult = [{}];
      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) => resolve(mockResult)),
      };
      db.select.mockReturnValue(mockQuery);

      await FinanceService.getFinancialStats({ 
        startDate: '2023-01-01', 
        endDate: '2023-01-31' 
      });

      expect(db.select).toHaveBeenCalled();
      // Verify that where() was called on each query
      expect(mockQuery.where).toHaveBeenCalledTimes(3);
    });

    it('should log and throw error on failure', async () => {
      db.select.mockImplementation(() => { throw new Error('DB Error'); });
      await expect(FinanceService.getFinancialStats()).rejects.toThrow('DB Error');
    });
  });

  describe('getAllTransactions', () => {
    const createMockChain = (results = []) => ({
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(results),
    });

    it('should fetch unified transactions and sort them', async () => {
      const mockFees = [{ id: 1, type: 'FEE', amount: '100', date: '2023-01-02' }];
      const mockCerts = [{ id: 2, type: 'CERTIFICATE', amount: '50', date: '2023-01-01' }];
      const mockSch = [{ id: 3, type: 'SCHOLARSHIP', amount: '200', date: '2023-01-03' }];

      const sharedMock = createMockChain();
      sharedMock.limit
        .mockResolvedValueOnce(mockFees)
        .mockResolvedValueOnce(mockCerts)
        .mockResolvedValueOnce(mockSch);

      db.select.mockReturnValue(sharedMock);

      const transactions = await FinanceService.getAllTransactions({ limit: 10 });

      expect(transactions).toHaveLength(3);
      expect(transactions[0].id).toBe(3); // Most recent first
      expect(transactions[1].id).toBe(1);
      expect(transactions[2].id).toBe(2);
    });

    it('should apply all filters for FEE type', async () => {
      const mockChain = createMockChain([]);
      db.select.mockReturnValue(mockChain);

      await FinanceService.getAllTransactions({ 
        type: 'FEE',
        rollNo: '22567T0901',
        startDate: '2023-01-01',
        endDate: '2023-12-31'
      });

      expect(db.select).toHaveBeenCalledTimes(1);
      expect(mockChain.where).toHaveBeenCalled();
    });

    it('should apply all filters for CERTIFICATE type', async () => {
      const mockChain = createMockChain([]);
      db.select.mockReturnValue(mockChain);

      await FinanceService.getAllTransactions({ 
        type: 'CERTIFICATE',
        status: 'APPROVED',
        rollNo: '22567T0901',
        startDate: '2023-01-01',
        endDate: '2023-12-31'
      });

      expect(db.select).toHaveBeenCalledTimes(1);
      expect(mockChain.where).toHaveBeenCalled();
    });

    it('should apply all filters for SCHOLARSHIP type', async () => {
      const mockChain = createMockChain([]);
      db.select.mockReturnValue(mockChain);

      await FinanceService.getAllTransactions({ 
        type: 'SCHOLARSHIP',
        status: 'RELEASED',
        rollNo: '22567T0901',
        startDate: '2023-01-01',
        endDate: '2023-12-31'
      });

      expect(db.select).toHaveBeenCalledTimes(1);
      expect(mockChain.where).toHaveBeenCalled();
    });

    it('should handle errors in getAllTransactions', async () => {
      db.select.mockImplementation(() => { throw new Error('Fetch Error'); });
      await expect(FinanceService.getAllTransactions({})).rejects.toThrow('Fetch Error');
    });
  });
});

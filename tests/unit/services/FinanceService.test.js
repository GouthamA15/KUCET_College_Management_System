import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FinanceService } from '@/services/FinanceService';
import { db } from '@/db';

// Mock dependencies
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    query: {
      studentFeePayments: { findFirst: vi.fn(), findMany: vi.fn() },
      studentRequests: { findFirst: vi.fn(), findMany: vi.fn() },
      scholarshipSanctions: { findMany: vi.fn() },
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

describe('FinanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getFinancialStats', () => {
    it('should calculate financial stats with only startDate', async () => {
      const mockRes = [{ totalFees: '1000' }];
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) => resolve(mockRes)),
      };
      db.select.mockReturnValue(mockChain);

      await FinanceService.getFinancialStats({ startDate: '2026-01-01' });
      expect(mockChain.where).toHaveBeenCalled();
    });

    it('should calculate financial stats with only endDate', async () => {
        const mockRes = [{ totalFees: '1000' }];
        const mockChain = {
          from: vi.fn().mockReturnThis(),
          leftJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          then: vi.fn((resolve) => resolve(mockRes)),
        };
        db.select.mockReturnValue(mockChain);
  
        await FinanceService.getFinancialStats({ endDate: '2026-12-31' });
        expect(mockChain.where).toHaveBeenCalled();
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

    it('should unified fetch and sort transactions', async () => {
      const mockFees = [{ id: 1, type: 'FEE', amount: '100', date: '2026-06-02' }];
      const mockCerts = [{ id: 2, type: 'CERTIFICATE', amount: '50', date: '2026-06-01' }];
      const mockSch = [{ id: 3, type: 'SCHOLARSHIP', amount: '200', date: '2026-06-03' }];

      const sharedMock = createMockChain();
      sharedMock.limit
        .mockResolvedValueOnce(mockFees)
        .mockResolvedValueOnce(mockCerts)
        .mockResolvedValueOnce(mockSch);

      db.select.mockReturnValue(sharedMock);

      const transactions = await FinanceService.getAllTransactions({ limit: 10 });

      expect(transactions).toHaveLength(3);
      expect(transactions[0].id).toBe(3);
    });

    it('should handle type filtering for FEE with date filters', async () => {
        const mockChain = createMockChain([]);
        db.select.mockReturnValue(mockChain);
        await FinanceService.getAllTransactions({ 
            type: 'FEE', 
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            rollNo: '22567T0901'
        });
        expect(mockChain.where).toHaveBeenCalled();
    });

    it('should handle type filtering for CERTIFICATE with filters', async () => {
        const mockChain = createMockChain([]);
        db.select.mockReturnValue(mockChain);
        await FinanceService.getAllTransactions({ 
            type: 'CERTIFICATE',
            status: 'APPROVED',
            startDate: '2026-01-01',
            rollNo: '22567T0901'
        });
        expect(mockChain.where).toHaveBeenCalled();
    });

    it('should handle type filtering for SCHOLARSHIP with filters', async () => {
        const mockChain = createMockChain([]);
        db.select.mockReturnValue(mockChain);
        await FinanceService.getAllTransactions({ 
            type: 'SCHOLARSHIP',
            status: 'RELEASED',
            endDate: '2026-12-31',
            rollNo: '22567T0901'
        });
        expect(mockChain.where).toHaveBeenCalled();
    });
  });

  describe('verifyTransactionIntegrity', () => {
    it('should flag UTR conflict in fee payments', async () => {
      db.query.studentFeePayments.findFirst.mockResolvedValue({ id: 1, student_id: 2 });
      const result = await FinanceService.verifyTransactionIntegrity({ 
        transactionId: 'UTR123', studentId: 3 
      });
      expect(result.isFlagged).toBe(true);
      expect(result.flagDetails.type).toBe('UTR_CONFLICT_FEE');
    });

    it('should NOT flag UTR conflict if it is the same record', async () => {
      db.query.studentFeePayments.findFirst.mockResolvedValue({ id: 1, student_id: 2 });
      const result = await FinanceService.verifyTransactionIntegrity({ 
        transactionId: 'UTR123', studentId: 2, feePaymentId: 1 
      });
      expect(result.isFlagged).toBe(false);
    });

    it('should flag UTR conflict in certificate requests', async () => {
        db.query.studentFeePayments.findFirst.mockResolvedValue(null);
        db.query.studentRequests.findFirst.mockResolvedValue({ request_id: 1, student_id: 2 });
        const result = await FinanceService.verifyTransactionIntegrity({ transactionId: 'UTR123', studentId: 3 });
        expect(result.isFlagged).toBe(true);
        expect(result.flagDetails.type).toBe('UTR_CONFLICT_REQUEST');
    });

    it('should NOT flag UTR conflict if it is the same request record', async () => {
        db.query.studentFeePayments.findFirst.mockResolvedValue(null);
        db.query.studentRequests.findFirst.mockResolvedValue({ request_id: 5, student_id: 2 });
        const result = await FinanceService.verifyTransactionIntegrity({ 
          transactionId: 'UTR123', studentId: 2, requestId: 5 
        });
        expect(result.isFlagged).toBe(false);
    });

    it('should flag screenshot hash conflict', async () => {
      db.query.studentFeePayments.findFirst.mockResolvedValue(null);
      db.query.studentRequests.findFirst.mockResolvedValue({ request_id: 1, student_id: 2 });
      
      const result = await FinanceService.verifyTransactionIntegrity({ 
        paymentHash: 'HASH123', studentId: 3 
      });
      expect(result.isFlagged).toBe(true);
      expect(result.flagDetails.type).toBe('HASH_CONFLICT');
    });
  });

  describe('getStudentFinancialSummary', () => {
    it('should aggregate financial data for a student', async () => {
      const mockSanctions = [
        { id: 1, sanctioned_amount: '35000', released_amount: '0', status: 'SANCTIONED' }
      ];
      const mockPayments = [
        { id: 1, amount: '5000', transaction_date: new Date() }
      ];

      db.query.scholarshipSanctions.findMany.mockResolvedValue(mockSanctions);
      db.query.studentFeePayments.findMany.mockResolvedValue(mockPayments);

      const summary = await FinanceService.getStudentFinancialSummary(1, '2025-26', 'CSE');

      expect(summary.feeSummary.govtPaid).toBe(35000);
      expect(summary.feeSummary.studentPaid).toBe(5000);
      expect(summary.feeSummary.totalFee).toBe(35000);
    });
    
    it('should handle SFC courses correctly', async () => {
        db.query.scholarshipSanctions.findMany.mockResolvedValue([]);
        db.query.studentFeePayments.findMany.mockResolvedValue([]);
        
        const summary = await FinanceService.getStudentFinancialSummary(1, '2025-26', 'IT');
        expect(summary.feeSummary.totalFee).toBe(70000);
        expect(summary.feeSummary.feeCategory).toBe('SFC');
    });

    it('should extract course from roll number if provided', async () => {
        db.query.scholarshipSanctions.findMany.mockResolvedValue([]);
        db.query.studentFeePayments.findMany.mockResolvedValue([]);
        
        const summary = await FinanceService.getStudentFinancialSummary(1, '2025-26', '22567T0901');
        expect(summary.feeSummary.totalFee).toBe(35000); // CSE is 35k
    });
  });
});

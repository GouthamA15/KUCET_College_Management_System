import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClerkRegistrationService } from '@/services/identity/ClerkRegistrationService';
import { db } from '@/db';
import { sendInstitutionalEmail } from '@/lib/email';

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/encryption', () => ({
  encrypt: vi.fn((val) => `enc_${val}`),
  hashForIndex: vi.fn((val) => `hash_${val}`),
}));

vi.mock('@/lib/email', () => ({
  sendInstitutionalEmail: vi.fn().mockResolvedValue({ success: true }),
  getBaseUrl: vi.fn().mockReturnValue('https://kucet.ac.in'),
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('ClerkRegistrationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('submitRegistrationRequest', () => {
    it('should successfully submit a valid clerk registration request', async () => {
      // Mock active clerks check -> empty
      const mockSelectClerk = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      // Mock pending requests check -> empty
      const mockSelectPending = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      db.select
        .mockReturnValueOnce(mockSelectClerk)
        .mockReturnValueOnce(mockSelectPending);

      db.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue([{ insertId: 42 }]),
      });

      const result = await ClerkRegistrationService.submitRegistrationRequest({
        name: 'John Clerk',
        email: 'john.clerk@kucet.ac.in',
        employee_id: 'EMP999',
        department: 'SCHOLARSHIP',
        designation: 'Senior Assistant',
        mobile: '9876543210',
      });

      expect(result.success).toBe(true);
      expect(result.requestId).toBe(42);
      expect(result.message).toContain('pending administrator approval');
    });

    it('should throw an error if duplicate active clerk exists', async () => {
      const mockSelectClerk = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 10 }]),
      };

      db.select.mockReturnValueOnce(mockSelectClerk);

      await expect(
        ClerkRegistrationService.submitRegistrationRequest({
          name: 'Duplicate Clerk',
          email: 'dup@kucet.ac.in',
          employee_id: 'EMP999',
          department: 'EXAMINATIONS',
          designation: 'Clerk',
        })
      ).rejects.toThrow('A clerk account with this Email or Employee ID already exists.');
    });

    it('should throw an error if duplicate pending request exists', async () => {
      const mockSelectClerk = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      const mockSelectPending = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 5 }]),
      };

      db.select
        .mockReturnValueOnce(mockSelectClerk)
        .mockReturnValueOnce(mockSelectPending);

      await expect(
        ClerkRegistrationService.submitRegistrationRequest({
          name: 'Pending Clerk',
          email: 'pending@kucet.ac.in',
          employee_id: 'EMP888',
          department: 'ACADEMIC',
          designation: 'Clerk',
        })
      ).rejects.toThrow('A pending registration request with this Email or Employee ID is currently awaiting administrator review.');
    });
  });

  describe('approveRequest', () => {
    it('should approve a pending registration request, create clerk account, and send welcome email', async () => {
      const pendingReq = {
        id: 42,
        name: 'John Clerk',
        email: 'john.clerk@kucet.ac.in',
        employee_id: 'EMP999',
        department: 'SCHOLARSHIP',
        designation: 'Senior Assistant',
        mobile: 'enc_9876543210',
        mobile_hash: 'hash_9876543210',
        pfp: null,
        signature: null,
        status: 'PENDING',
      };

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([pendingReq]),
      };
      db.select.mockReturnValue(mockSelect);

      db.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue([{ insertId: 101 }]),
      });

      db.update.mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ affectedRows: 1 }]),
      });

      const result = await ClerkRegistrationService.approveRequest(42, 1);

      expect(result.success).toBe(true);
      expect(result.clerkId).toBe(101);
      expect(sendInstitutionalEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'john.clerk@kucet.ac.in',
          subject: 'Account Approved - KUCET College Management System',
        })
      );
    });
  });

  describe('rejectRequest', () => {
    it('should reject a pending request and send rejection email', async () => {
      const pendingReq = {
        id: 43,
        name: 'Jane Reject',
        email: 'jane@kucet.ac.in',
        employee_id: 'EMP777',
        department: 'CSE',
        status: 'PENDING',
      };

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([pendingReq]),
      };
      db.select.mockReturnValue(mockSelect);

      db.update.mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ affectedRows: 1 }]),
      });

      const result = await ClerkRegistrationService.rejectRequest(43, 1, 'Invalid employee credentials');

      expect(result.success).toBe(true);
      expect(sendInstitutionalEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'jane@kucet.ac.in',
          subject: 'Registration Request Status - KUCET College Management System',
        })
      );
    });
  });
});

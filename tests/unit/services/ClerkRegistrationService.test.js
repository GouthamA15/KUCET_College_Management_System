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
    it('should successfully submit a valid Faculty registration request with branch', async () => {
      const mockSelectClerk = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
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
        name: 'Dr. K. Ramesh',
        email: 'ramesh@kucet.ac.in',
        employee_id: 'FAC1024',
        staff_category: 'FACULTY',
        branch: 'CSE',
        mobile: '9876543210',
      });

      expect(result.success).toBe(true);
      expect(result.requestId).toBe(42);
      expect(result.message).toContain('Faculty (CSE)');
    });

    it('should throw an error if Faculty registration is missing branch', async () => {
      await expect(
        ClerkRegistrationService.submitRegistrationRequest({
          name: 'Invalid Faculty',
          email: 'fac@kucet.ac.in',
          employee_id: 'FAC999',
          staff_category: 'FACULTY',
          branch: '',
        })
      ).rejects.toThrow('Faculty members must select a valid academic branch');
    });

    it('should throw an error if registration category is invalid', async () => {
      await expect(
        ClerkRegistrationService.submitRegistrationRequest({
          name: 'Invalid Role',
          email: 'invalid@kucet.ac.in',
          employee_id: 'EMP000',
          staff_category: 'EXAM_CELL',
        })
      ).rejects.toThrow('Invalid staff registration category');
    });

    it('should throw an error if duplicate active staff exists', async () => {
      const mockSelectClerk = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 10 }]),
      };

      db.select.mockReturnValueOnce(mockSelectClerk);

      await expect(
        ClerkRegistrationService.submitRegistrationRequest({
          name: 'Duplicate Staff',
          email: 'dup@kucet.ac.in',
          employee_id: 'EMP999',
          staff_category: 'SCHOLARSHIP_CLERK',
        })
      ).rejects.toThrow('A staff account with this Email or Employee ID already exists.');
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
          name: 'Pending Staff',
          email: 'pending@kucet.ac.in',
          employee_id: 'EMP888',
          staff_category: 'ADMISSION_CLERK',
        })
      ).rejects.toThrow('A pending registration request with this Email or Employee ID is currently awaiting administrator review.');
    });
  });

  describe('approveRequest', () => {
    it('should approve a pending registration request, create staff account, and send welcome email', async () => {
      const pendingReq = {
        id: 42,
        name: 'Dr. K. Ramesh',
        email: 'ramesh@kucet.ac.in',
        employee_id: 'FAC1024',
        staff_category: 'FACULTY',
        branch: 'CSE',
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
          to: 'ramesh@kucet.ac.in',
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
        staff_category: 'ADMISSION_CLERK',
        branch: null,
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

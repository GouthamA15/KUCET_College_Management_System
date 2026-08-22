import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StaffRegistrationService } from '@/services/identity/StaffRegistrationService';
import { db } from '@/db';

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/encryption', () => ({
  encrypt: vi.fn((val) => `enc_${val}`),
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

describe('StaffRegistrationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('submitRegistrationRequest', () => {
    it('should successfully submit a valid Faculty registration request with branch', async () => {
      const mockSelectStaff = {
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
        .mockReturnValueOnce(mockSelectStaff)
        .mockReturnValueOnce(mockSelectPending);

      db.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue([{ insertId: 42 }]),
      });

      const result = await StaffRegistrationService.submitRegistrationRequest({
        name: 'Dr. K. Ramesh',
        email: 'ramesh@kucet.ac.in',
        employee_id: 'FAC_CSE_042',
        staff_category: 'FACULTY',
        branch: 'CSE',
        mobile: '9876543210',
      });

      expect(result.success).toBe(true);
      expect(result.requestId).toBe(42);
      expect(result.message).toContain('Faculty');
      expect(result.message).toContain('CSE');
    });

    it('should reject submission if staff category is invalid', async () => {
      await expect(
        StaffRegistrationService.submitRegistrationRequest({
          name: 'Invalid User',
          email: 'invalid@kucet.ac.in',
          employee_id: 'EMP_000',
          staff_category: 'SUPER_ADMIN',
        })
      ).rejects.toThrow('Invalid staff registration category');
    });

    it('should reject Faculty submission if branch is missing', async () => {
      await expect(
        StaffRegistrationService.submitRegistrationRequest({
          name: 'Dr. No Branch',
          email: 'nobranch@kucet.ac.in',
          employee_id: 'FAC_001',
          staff_category: 'FACULTY',
          branch: '',
        })
      ).rejects.toThrow('Faculty members must select a valid academic branch');
    });

    it('should reject submission if duplicate active staff exists', async () => {
      const mockSelectStaff = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 10 }]),
      };

      db.select.mockReturnValueOnce(mockSelectStaff);

      await expect(
        StaffRegistrationService.submitRegistrationRequest({
          name: 'Dr. Existing',
          email: 'existing@kucet.ac.in',
          employee_id: 'FAC_EXIST',
          staff_category: 'FACULTY',
          branch: 'ECE',
        })
      ).rejects.toThrow('A staff account with this Email or Employee ID already exists');
    });
  });

  describe('rejectRequest', () => {
    it('should successfully reject a pending request with a custom reason', async () => {
      const mockSelectPending = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: 43,
            name: 'Applicant Name',
            email: 'applicant@kucet.ac.in',
            employee_id: 'EMP_43',
            staff_category: 'SCHOLARSHIP_STAFF',
            status: 'PENDING',
          },
        ]),
      };

      db.select.mockReturnValueOnce(mockSelectPending);
      db.update.mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ affectedRows: 1 }]),
      });

      const result = await StaffRegistrationService.rejectRequest(43, 1, 'Invalid employee credentials');

      expect(result.success).toBe(true);
      expect(result.message).toContain('rejected');
    });
  });

  describe('Canonical Staff Category & Zero Clerk Policy', () => {
    it('should accept ADMISSION_STAFF category', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      db.select.mockReturnValueOnce(mockSelect).mockReturnValueOnce(mockSelect);
      db.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue([{ insertId: 50 }]),
      });

      const result = await StaffRegistrationService.submitRegistrationRequest({
        name: 'Admission Staff Member',
        email: 'adm.staff@kucet.ac.in',
        employee_id: 'ADM_001',
        staff_category: 'ADMISSION_STAFF',
        mobile: '9876543211',
      });

      expect(result.success).toBe(true);
      expect(result.requestId).toBe(50);
    });

    it('should accept SCHOLARSHIP_STAFF category', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      db.select.mockReturnValueOnce(mockSelect).mockReturnValueOnce(mockSelect);
      db.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue([{ insertId: 51 }]),
      });

      const result = await StaffRegistrationService.submitRegistrationRequest({
        name: 'Scholarship Staff Member',
        email: 'sch.staff@kucet.ac.in',
        employee_id: 'SCH_001',
        staff_category: 'SCHOLARSHIP_STAFF',
        mobile: '9876543212',
      });

      expect(result.success).toBe(true);
      expect(result.requestId).toBe(51);
    });

    it('should reject legacy ADMISSION_CLERK', async () => {
      await expect(
        StaffRegistrationService.submitRegistrationRequest({
          name: 'Legacy Admission',
          email: 'legacy.adm@kucet.ac.in',
          employee_id: 'LEG_001',
          staff_category: 'ADMISSION_CLERK',
        })
      ).rejects.toThrow('Invalid staff registration category');
    });

    it('should reject legacy SCHOLARSHIP_CLERK', async () => {
      await expect(
        StaffRegistrationService.submitRegistrationRequest({
          name: 'Legacy Scholarship',
          email: 'legacy.sch@kucet.ac.in',
          employee_id: 'LEG_002',
          staff_category: 'SCHOLARSHIP_CLERK',
        })
      ).rejects.toThrow('Invalid staff registration category');
    });

    it('should reject legacy CLERK', async () => {
      await expect(
        StaffRegistrationService.submitRegistrationRequest({
          name: 'Legacy Clerk',
          email: 'legacy.clk@kucet.ac.in',
          employee_id: 'LEG_003',
          staff_category: 'CLERK',
        })
      ).rejects.toThrow('Invalid staff registration category');
    });
  });
});

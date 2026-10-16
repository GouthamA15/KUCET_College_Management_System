import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StudentCertificateService } from '@/services/identity/StudentCertificateService';

describe('Certificate Routing & State Machine Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('StudentCertificateService.determineCertificateRouting', () => {
    it('routes No Objection Certificate strictly to Branch HOD with PENDING status', async () => {
      // 21567T0901 is CSE branch (09)
      const routing = await StudentCertificateService.determineCertificateRouting(
        'No Objection Certificate',
        '21567T0901'
      );

      expect(routing.staffType).toBe('hod');
      expect(routing.hodApprovalStatus).toBe('PENDING');
      expect(routing.requiresHod).toBe(true);
      expect(routing.branch).toBe('CSE');
    });

    it('routes Bonafide Certificate to HOD when an active HOD exists for the branch', async () => {
      vi.spyOn(StudentCertificateService, 'getActiveHodForBranch').mockResolvedValue({
        id: 1,
        staff_account_id: 42,
        department_code: 'CSE',
        is_active: true
      });

      const routing = await StudentCertificateService.determineCertificateRouting(
        'Bonafide Certificate',
        '21567T0901'
      );

      expect(routing.staffType).toBe('hod');
      expect(routing.hodApprovalStatus).toBe('PENDING');
      expect(routing.requiresHod).toBe(true);
      expect(routing.hodStaffId).toBe(42);
    });

    it('routes Bonafide Certificate directly to Admission Staff when no active HOD is assigned', async () => {
      vi.spyOn(StudentCertificateService, 'getActiveHodForBranch').mockResolvedValue(null);

      const routing = await StudentCertificateService.determineCertificateRouting(
        'Bonafide Certificate',
        '21567T0901'
      );

      expect(routing.staffType).toBe('admission');
      expect(routing.hodApprovalStatus).toBe('NOT_REQUIRED');
      expect(routing.requiresHod).toBe(false);
    });

    it('routes Scholarship certificates to scholarship staff with NOT_REQUIRED hod status', async () => {
      const routing = await StudentCertificateService.determineCertificateRouting(
        'Income Tax (IT) Certificate',
        '21567T0901'
      );

      expect(routing.staffType).toBe('scholarship');
      expect(routing.hodApprovalStatus).toBe('NOT_REQUIRED');
      expect(routing.requiresHod).toBe(false);
    });

    it('routes Transfer Certificate (TC) directly to admission staff with NOT_REQUIRED hod status', async () => {
      const routing = await StudentCertificateService.determineCertificateRouting(
        'Transfer Certificate (TC)',
        '21567T0901'
      );

      expect(routing.staffType).toBe('admission');
      expect(routing.hodApprovalStatus).toBe('NOT_REQUIRED');
      expect(routing.requiresHod).toBe(false);
    });
  });
});

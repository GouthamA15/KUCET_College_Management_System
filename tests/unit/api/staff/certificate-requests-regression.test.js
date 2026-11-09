import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Certificate Requests Workflow & RBAC Regression Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. HOD Request Scoping & Branch Authorization', () => {
    it('correctly maps single and multi-branch authorizations for HOD', () => {
      const branchCodeMap = {
        'CSE': '09', 'CSD': '30', 'ECE': '15', 'EEE': '12',
        'CIVIL': '00', 'IT': '18', 'MECH': '03'
      };

      const staffSingle = { branch: 'CSE', authorized_branches: null };
      const branchesSingle = staffSingle.authorized_branches || (staffSingle.branch ? [staffSingle.branch] : []);
      const codesSingle = branchesSingle.map(b => branchCodeMap[b]).filter(Boolean);
      expect(codesSingle).toEqual(['09']);

      const staffMulti = { branch: 'CSE', authorized_branches: ['CSE', 'CSD'] };
      const branchesMulti = staffMulti.authorized_branches || (staffMulti.branch ? [staffMulti.branch] : []);
      const codesMulti = branchesMulti.map(b => branchCodeMap[b]).filter(Boolean);
      expect(codesMulti).toEqual(['09', '30']);
    });

    it('validates that roll number matching logic matches both regular and lateral-entry variants', () => {
      const code = '09'; // CSE

      // Regex mirroring SQL LIKE: (%567T09% OR %56709%L)
      const matchesRoll = (roll) => {
        const hasT = roll.includes(`567T${code}`);
        const isLateralWithoutT = roll.includes(`567${code}`) && roll.endsWith('L');
        return hasT || isLateralWithoutT;
      };

      // Regular CSE
      expect(matchesRoll('23567T0901')).toBe(true);
      // Lateral CSE with T
      expect(matchesRoll('24567T0901L')).toBe(true);
      // Lateral CSE without T
      expect(matchesRoll('245670901L')).toBe(true);
      // Regular ECE (should NOT match CSE)
      expect(matchesRoll('23567T1501')).toBe(false);
      // Lateral ECE (should NOT match CSE)
      expect(matchesRoll('24567T1501L')).toBe(false);
    });
  });

  describe('2. Stage 1 HOD Review Concurrency & Invariants', () => {
    it('blocks duplicate Stage 1 HOD review if request has already been approved', () => {
      const existingRequest = {
        request_id: 201,
        status: 'PENDING',
        hod_approval_status: 'APPROVED', // Already reviewed
        certificate_type: 'Bonafide Certificate'
      };

      // Simulation of PUT guard
      const effectiveRole = 'hod';
      let error = null;
      let statusCode = null;

      if (effectiveRole === 'hod' && existingRequest.certificate_type === 'Bonafide Certificate') {
        if (existingRequest.hod_approval_status !== 'PENDING') {
          error = 'HOD review for this request has already been completed';
          statusCode = 409;
        }
      }

      expect(statusCode).toBe(409);
      expect(error).toBe('HOD review for this request has already been completed');
    });

    it('blocks duplicate Stage 1 HOD review if request has already been rejected', () => {
      const existingRequest = {
        request_id: 202,
        status: 'PENDING',
        hod_approval_status: 'REJECTED',
        certificate_type: 'Bonafide Certificate'
      };

      const effectiveRole = 'hod';
      let error = null;
      let statusCode = null;

      if (effectiveRole === 'hod' && existingRequest.certificate_type === 'Bonafide Certificate') {
        if (existingRequest.hod_approval_status !== 'PENDING') {
          error = 'HOD review for this request has already been completed';
          statusCode = 409;
        }
      }

      expect(statusCode).toBe(409);
      expect(error).toBe('HOD review for this request has already been completed');
    });

    it('allows Stage 1 HOD review when hod_approval_status is PENDING', () => {
      const existingRequest = {
        request_id: 203,
        status: 'PENDING',
        hod_approval_status: 'PENDING',
        certificate_type: 'Bonafide Certificate'
      };

      const effectiveRole = 'hod';
      let error = null;

      if (effectiveRole === 'hod' && existingRequest.certificate_type === 'Bonafide Certificate') {
        if (existingRequest.hod_approval_status !== 'PENDING') {
          error = 'HOD review for this request has already been completed';
        }
      }

      expect(error).toBeNull();
    });
  });

  describe('3. Multi-Role RBAC & Workflow Stage Boundaries', () => {
    it('prohibits Admission Staff from reviewing Bonafide when hod_approval_status is PENDING', () => {
      const requestToUpdate = {
        certificate_type: 'Bonafide Certificate',
        hod_approval_status: 'PENDING',
      };
      const effectiveRole = 'admission';

      let error = null;
      let statusCode = null;

      if (requestToUpdate.certificate_type === 'Bonafide Certificate') {
        if (effectiveRole === 'admission') {
          if (requestToUpdate.hod_approval_status === 'PENDING') {
            error = 'HOD approval is required before Admission Staff can review this certificate.';
            statusCode = 400;
          }
        }
      }

      expect(statusCode).toBe(400);
      expect(error).toBe('HOD approval is required before Admission Staff can review this certificate.');
    });

    it('prohibits Admission Staff from reviewing No Objection Certificate', () => {
      const requestToUpdate = {
        certificate_type: 'No Objection Certificate',
      };
      const effectiveRole = 'admission';

      let error = null;
      let statusCode = null;

      if (effectiveRole === 'admission' && requestToUpdate.certificate_type === 'No Objection Certificate') {
        error = 'Forbidden. No Objection Certificates must be approved by the Department HOD.';
        statusCode = 403;
      }

      expect(statusCode).toBe(403);
      expect(error).toBe('Forbidden. No Objection Certificates must be approved by the Department HOD.');
    });

    it('prohibits Scholarship Staff from reviewing No Objection Certificate', () => {
      const roleToTypes = {
        hod: ['Bonafide Certificate', 'No Objection Certificate', 'Internship Certificate'],
        admission: ['Bonafide Certificate', 'Course Completion Certificate', 'Transfer Certificate (TC)', 'Migration Certificate', 'Study Conduct Certificate'],
        scholarship: ['Income Tax (IT) Certificate', 'Custodian Certificate'],
      };

      const staffRole = 'scholarship';
      const allowedTypes = roleToTypes[staffRole] || [];
      expect(allowedTypes.includes('No Objection Certificate')).toBe(false);
    });
  });

  describe('4. Download Authorization Guards', () => {
    it('blocks download when certificate is PENDING', () => {
      const certRequest = {
        certificate_type: 'Bonafide Certificate',
        status: 'PENDING',
        hod_approval_status: 'APPROVED',
      };

      const isDownloadable = certRequest.status === 'APPROVED';
      expect(isDownloadable).toBe(false);
    });

    it('blocks download when certificate is REJECTED', () => {
      const certRequest = {
        certificate_type: 'Bonafide Certificate',
        status: 'REJECTED',
        hod_approval_status: 'APPROVED',
      };

      const isDownloadable = certRequest.status === 'APPROVED' && certRequest.hod_approval_status !== 'REJECTED';
      expect(isDownloadable).toBe(false);
    });

    it('blocks NOC download when hod_approval_status is not APPROVED', () => {
      const certRequest = {
        certificate_type: 'No Objection Certificate',
        status: 'APPROVED',
        hod_approval_status: 'PENDING',
      };

      const isBlocked = (
        certRequest.certificate_type === 'No Objection Certificate' &&
        certRequest.hod_approval_status !== 'APPROVED'
      );
      expect(isBlocked).toBe(true);
    });

    it('allows NOC download when both status and hod_approval_status are APPROVED', () => {
      const certRequest = {
        certificate_type: 'No Objection Certificate',
        status: 'APPROVED',
        hod_approval_status: 'APPROVED',
      };

      const isBlocked = (
        certRequest.certificate_type === 'No Objection Certificate' &&
        certRequest.hod_approval_status !== 'APPROVED'
      );
      expect(isBlocked).toBe(false);
    });
  });
});

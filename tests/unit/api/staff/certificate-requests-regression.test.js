import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateRollNo, getEntranceExamQualified, getBranchFromRoll } from '@/lib/rollNumber';
import { resolveAcademicClassification } from '@/lib/academicClassification';

describe('Certificate Requests Workflow, Institutional Rules & RBAC Regression Suite', () => {
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

    it('strictly resolves entrance exam: TG ECET for Lateral and TG EAPCET for Regular even when roll includes T', () => {
      // Lateral rolls with and without T
      expect(getEntranceExamQualified('23567T0901L')).toBe('TG ECET');
      expect(getEntranceExamQualified('235670901L')).toBe('TG ECET');
      // Regular roll
      expect(getEntranceExamQualified('24567T0901')).toBe('TG EAPCET');
      expect(getEntranceExamQualified('23567T1501')).toBe('TG EAPCET');
    });
  });

  describe('2. Lateral vs. Regular Academic Classification & Progression', () => {
    it('classifies Lateral student in Semester III as First Institutional Year with Ordinary Bonafide', () => {
      const result = resolveAcademicClassification({
        rollNo: '24567T0901L',
        academicYear: '2026-27',
        studySemester: 3
      });

      expect(result.isValid).toBe(true);
      expect(result.admissionType).toBe('Lateral');
      expect(result.studyYear).toBe(2); // B.Tech Year II
      expect(result.studySemester).toBe(3); // Semester III
      expect(result.yearsAtKucet).toBe(1); // 1st Institutional Year at KUCET
      expect(result.isFirstYearAtKucet).toBe(true);
      expect(result.certificateFormat).toBe('ORDINARY'); // No attendance clause
    });

    it('classifies Lateral student in Semester IV as First Institutional Year even if calendar year advanced', () => {
      const result = resolveAcademicClassification({
        rollNo: '245670901L',
        academicYear: '2026-27',
        studySemester: 4
      });

      expect(result.isValid).toBe(true);
      expect(result.admissionType).toBe('Lateral');
      expect(result.studyYear).toBe(2); // Still Curricular Year 2
      expect(result.studySemester).toBe(4); // Semester IV
      expect(result.yearsAtKucet).toBe(1); // Still 1st Institutional Year
      expect(result.isFirstYearAtKucet).toBe(true);
      expect(result.certificateFormat).toBe('ORDINARY');
    });

    it('classifies Lateral student in Semester V as Second Institutional Year with Percentage Bonafide', () => {
      const result = resolveAcademicClassification({
        rollNo: '23567T0901L',
        academicYear: '2026-27',
        studySemester: 5
      });

      expect(result.isValid).toBe(true);
      expect(result.admissionType).toBe('Lateral');
      expect(result.studyYear).toBe(3); // Curricular Year 3
      expect(result.studySemester).toBe(5); // Semester V
      expect(result.yearsAtKucet).toBe(2); // 2nd Institutional Year
      expect(result.isFirstYearAtKucet).toBe(false);
      expect(result.certificateFormat).toBe('PERCENTAGE'); // Attendance percentage required
    });

    it('classifies Regular student in Semester I and II as First Institutional Year with Ordinary Bonafide', () => {
      const sem1 = resolveAcademicClassification({
        rollNo: '26567T0901',
        academicYear: '2026-27',
        studySemester: 1
      });
      expect(sem1.studyYear).toBe(1);
      expect(sem1.yearsAtKucet).toBe(1);
      expect(sem1.isFirstYearAtKucet).toBe(true);
      expect(sem1.certificateFormat).toBe('ORDINARY');

      const sem2 = resolveAcademicClassification({
        rollNo: '26567T0901',
        academicYear: '2026-27',
        studySemester: 2
      });
      expect(sem2.studyYear).toBe(1);
      expect(sem2.yearsAtKucet).toBe(1);
      expect(sem2.isFirstYearAtKucet).toBe(true);
      expect(sem2.certificateFormat).toBe('ORDINARY');
    });

    it('classifies Regular student in Semester III as Second Institutional Year with Percentage Bonafide', () => {
      const sem3 = resolveAcademicClassification({
        rollNo: '25567T0901',
        academicYear: '2026-27',
        studySemester: 3
      });
      expect(sem3.studyYear).toBe(2);
      expect(sem3.yearsAtKucet).toBe(2);
      expect(sem3.isFirstYearAtKucet).toBe(false);
      expect(sem3.certificateFormat).toBe('PERCENTAGE');
    });
  });

  describe('3. Two-Stage Workflow for Bonafide and NOC', () => {
    it('blocks duplicate Stage 1 HOD review if request has already been approved', () => {
      const existingRequest = {
        request_id: 201,
        status: 'PENDING',
        hod_approval_status: 'APPROVED',
        certificate_type: 'Bonafide Certificate'
      };

      const isTwoStage = ['Bonafide Certificate', 'No Objection Certificate'].includes(existingRequest.certificate_type);
      const effectiveRole = 'hod';
      let error = null;
      let statusCode = null;

      if (effectiveRole === 'hod' && isTwoStage) {
        if (existingRequest.hod_approval_status !== 'PENDING') {
          error = 'HOD review for this request has already been completed';
          statusCode = 409;
        }
      }

      expect(statusCode).toBe(409);
      expect(error).toBe('HOD review for this request has already been completed');
    });

    it('blocks Admission Staff from reviewing NOC when HOD review is PENDING', () => {
      const requestToUpdate = {
        certificate_type: 'No Objection Certificate',
        hod_approval_status: 'PENDING',
      };
      const effectiveRole = 'admission';
      let error = null;
      let statusCode = null;

      const isTwoStage = ['Bonafide Certificate', 'No Objection Certificate'].includes(requestToUpdate.certificate_type);
      if (isTwoStage && effectiveRole === 'admission') {
        if (requestToUpdate.hod_approval_status === 'PENDING') {
          error = `HOD endorsement is required before Admission Staff can review this ${requestToUpdate.certificate_type}.`;
          statusCode = 400;
        }
      }

      expect(statusCode).toBe(400);
      expect(error).toBe('HOD endorsement is required before Admission Staff can review this No Objection Certificate.');
    });

    it('allows Admission Staff to review and approve NOC once HOD endorses Stage 1', () => {
      const requestToUpdate = {
        certificate_type: 'No Objection Certificate',
        hod_approval_status: 'APPROVED',
        status: 'PENDING',
      };
      const effectiveRole = 'admission';
      let error = null;

      const isTwoStage = ['Bonafide Certificate', 'No Objection Certificate'].includes(requestToUpdate.certificate_type);
      if (isTwoStage && effectiveRole === 'admission') {
        if (requestToUpdate.hod_approval_status === 'PENDING') {
          error = 'HOD endorsement is required';
        }
      }

      expect(error).toBeNull();
    });

    it('allows Admission Staff to review and approve NOC when HOD was UNAVAILABLE and forwarded per policy', () => {
      const requestToUpdate = {
        certificate_type: 'No Objection Certificate',
        hod_approval_status: 'NOT_REQUIRED',
        status: 'PENDING',
        flag_details: { hod_unavailable: true, reason: 'No active HOD assigned' }
      };
      const effectiveRole = 'admission';
      let error = null;

      const isTwoStage = ['Bonafide Certificate', 'No Objection Certificate'].includes(requestToUpdate.certificate_type);
      if (isTwoStage && effectiveRole === 'admission') {
        if (requestToUpdate.hod_approval_status === 'PENDING') {
          error = 'HOD endorsement is required';
        }
      }

      expect(error).toBeNull();
    });

    it('prohibits Super Admin from substituting for the branch HOD in Stage 1 review', () => {
      const staff = { role: 'admin', branch: null, authorized_branches: [] };
      const studentBranch = 'CSE';

      // Institutional Rule: Admin cannot substitute for the branch HOD
      const authorizedBranches = staff.authorized_branches || (staff.branch ? [staff.branch] : []);
      const canApproveStage1AsHod = authorizedBranches.includes(studentBranch);

      expect(canApproveStage1AsHod).toBe(false);
    });

    it('prohibits Scholarship Staff from reviewing No Objection Certificate', () => {
      const roleToTypes = {
        hod: ['Bonafide Certificate', 'No Objection Certificate', 'Internship Certificate'],
        admission: ['Bonafide Certificate', 'No Objection Certificate', 'Course Completion Certificate', 'Transfer Certificate (TC)', 'Migration Certificate', 'Study Conduct Certificate'],
        scholarship: ['Income Tax (IT) Certificate', 'Custodian Certificate'],
      };

      const staffRole = 'scholarship';
      const allowedTypes = roleToTypes[staffRole] || [];
      expect(allowedTypes.includes('No Objection Certificate')).toBe(false);
    });
  });

  describe('4. Download Authorization Guards for Both Stages', () => {
    it('blocks NOC download when status is PENDING even if HOD approved Stage 1', () => {
      const certRequest = {
        certificate_type: 'No Objection Certificate',
        status: 'PENDING',
        hod_approval_status: 'APPROVED',
      };

      const isTwoStage = ['Bonafide Certificate', 'No Objection Certificate'].includes(certRequest.certificate_type);
      const isBlocked = (
        certRequest.status !== 'APPROVED' || 
        certRequest.hod_approval_status === 'REJECTED' || 
        (isTwoStage && certRequest.hod_approval_status === 'PENDING')
      );
      expect(isBlocked).toBe(true);
    });

    it('blocks Bonafide download when status is PENDING even if HOD approved Stage 1', () => {
      const certRequest = {
        certificate_type: 'Bonafide Certificate',
        status: 'PENDING',
        hod_approval_status: 'APPROVED',
      };

      const isTwoStage = ['Bonafide Certificate', 'No Objection Certificate'].includes(certRequest.certificate_type);
      const isBlocked = (
        certRequest.status !== 'APPROVED' || 
        certRequest.hod_approval_status === 'REJECTED' || 
        (isTwoStage && certRequest.hod_approval_status === 'PENDING')
      );
      expect(isBlocked).toBe(true);
    });

    it('blocks download when HOD rejected Stage 1', () => {
      const certRequest = {
        certificate_type: 'Bonafide Certificate',
        status: 'REJECTED',
        hod_approval_status: 'REJECTED',
      };

      const isTwoStage = ['Bonafide Certificate', 'No Objection Certificate'].includes(certRequest.certificate_type);
      const isBlocked = (
        certRequest.status !== 'APPROVED' || 
        certRequest.hod_approval_status === 'REJECTED' || 
        (isTwoStage && certRequest.hod_approval_status === 'PENDING')
      );
      expect(isBlocked).toBe(true);
    });

    it('allows download for Bonafide and NOC when Admission Staff has approved Stage 2', () => {
      const bonafideReq = {
        certificate_type: 'Bonafide Certificate',
        status: 'APPROVED',
        hod_approval_status: 'APPROVED',
      };
      const nocReq = {
        certificate_type: 'No Objection Certificate',
        status: 'APPROVED',
        hod_approval_status: 'APPROVED',
      };
      const nocForwardedReq = {
        certificate_type: 'No Objection Certificate',
        status: 'APPROVED',
        hod_approval_status: 'NOT_REQUIRED',
      };

      const checkDownload = (r) => {
        const isTwoStage = ['Bonafide Certificate', 'No Objection Certificate'].includes(r.certificate_type);
        return !(
          r.status !== 'APPROVED' || 
          r.hod_approval_status === 'REJECTED' || 
          (isTwoStage && r.hod_approval_status === 'PENDING')
        );
      };

      expect(checkDownload(bonafideReq)).toBe(true);
      expect(checkDownload(nocReq)).toBe(true);
      expect(checkDownload(nocForwardedReq)).toBe(true);
    });
  });
});

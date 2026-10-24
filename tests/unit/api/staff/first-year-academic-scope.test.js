import { describe, it, expect } from 'vitest';
import { 
  isAcademicScopeAllowed, 
  assertAcademicScope, 
  getAllowedAcademicSemesters,
  INSTITUTIONAL_BRANCHES 
} from '@/lib/academic-authorization';

describe('First Year Coordinator Academic Scope Authorization', () => {
  const coordinatorUser = {
    id: 101,
    role: 'faculty',
    is_first_year_coordinator: true,
    branch: 'CSE',
  };

  const hodCseUser = {
    id: 102,
    role: 'faculty',
    is_hod: true,
    hod_department_code: 'CSE',
    branch: 'CSE',
  };

  const dualRoleUser = {
    id: 103,
    role: 'faculty',
    is_hod: true,
    hod_department_code: 'CSE',
    is_first_year_coordinator: true,
    branch: 'CSE',
  };

  const regularFacultyUser = {
    id: 104,
    role: 'faculty',
    branch: 'CSE',
  };

  const adminUser = {
    id: 1,
    role: 'admin',
  };

  describe('Coordinator Scope across All Branches (Sem 1 & 2)', () => {
    it('authorizes coordinator for Semesters 1 and 2 across ALL institutional branches', () => {
      for (const branch of INSTITUTIONAL_BRANCHES) {
        expect(isAcademicScopeAllowed(coordinatorUser, { branch, semester: 1 })).toBe(true);
        expect(isAcademicScopeAllowed(coordinatorUser, { branch, semester: 2 })).toBe(true);
      }
    });

    it('strictly denies coordinator for Semesters 3 through 8 across all branches', () => {
      for (const branch of INSTITUTIONAL_BRANCHES) {
        for (let sem = 3; sem <= 8; sem++) {
          expect(isAcademicScopeAllowed(coordinatorUser, { branch, semester: sem })).toBe(false);
        }
      }
    });

    it('assertAcademicScope throws 403 when coordinator attempts to access semester 3', () => {
      expect(() => {
        assertAcademicScope(coordinatorUser, { branch: 'CSE', semester: 3 });
      }).toThrow(/Forbidden/);
    });
  });

  describe('HOD Regression Protection (Semesters 1–8 in Department)', () => {
    it('preserves full HOD authority across Semesters 1 to 8 within assigned department', () => {
      for (let sem = 1; sem <= 8; sem++) {
        expect(isAcademicScopeAllowed(hodCseUser, { branch: 'CSE', semester: sem })).toBe(true);
      }
    });

    it('denies HOD access to other departments across all semesters', () => {
      for (let sem = 1; sem <= 8; sem++) {
        expect(isAcademicScopeAllowed(hodCseUser, { branch: 'ECE', semester: sem })).toBe(false);
      }
    });
  });

  describe('Dual-Role Union (HOD + First Year Coordinator)', () => {
    it('maintains union of HOD (CSE Sem 1-8) and Coordinator (All branches Sem 1-2)', () => {
      // CSE department: full semesters 1-8 allowed
      for (let sem = 1; sem <= 8; sem++) {
        expect(isAcademicScopeAllowed(dualRoleUser, { branch: 'CSE', semester: sem })).toBe(true);
      }

      // Other branches: semesters 1 and 2 allowed
      for (const branch of ['ECE', 'EEE', 'IT', 'CSD', 'CIVIL', 'MECH']) {
        expect(isAcademicScopeAllowed(dualRoleUser, { branch, semester: 1 })).toBe(true);
        expect(isAcademicScopeAllowed(dualRoleUser, { branch, semester: 2 })).toBe(true);
        
        // Other branches: semesters 3-8 forbidden!
        expect(isAcademicScopeAllowed(dualRoleUser, { branch, semester: 3 })).toBe(false);
        expect(isAcademicScopeAllowed(dualRoleUser, { branch, semester: 6 })).toBe(false);
      }
    });
  });

  describe('Regular Faculty & Administrator Checks', () => {
    it('denies regular faculty without HOD or Coordinator role', () => {
      expect(isAcademicScopeAllowed(regularFacultyUser, { branch: 'CSE', semester: 1 })).toBe(false);
    });

    it('authorizes admin across all branches and semesters', () => {
      expect(isAcademicScopeAllowed(adminUser, { branch: 'MECH', semester: 7 })).toBe(true);
    });
  });

  describe('getAllowedAcademicSemesters helper', () => {
    it('returns [1, 2] for coordinator-only user', () => {
      expect(getAllowedAcademicSemesters(coordinatorUser, 'ECE')).toEqual([1, 2]);
    });

    it('returns [1, 2, 3, 4, 5, 6, 7, 8] for HOD within their branch', () => {
      expect(getAllowedAcademicSemesters(hodCseUser, 'CSE')).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it('returns [1, 2] for dual-role user in outside branch and [1..8] in their department', () => {
      expect(getAllowedAcademicSemesters(dualRoleUser, 'ECE')).toEqual([1, 2]);
      expect(getAllowedAcademicSemesters(dualRoleUser, 'CSE')).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });
  });
});

import { describe, it, expect, vi } from 'vitest';
import { IDCardAuthorizationService } from '@/services/identity/IDCardAuthorizationService';
import { IDCardDataService } from '@/services/identity/IDCardDataService';
import * as academicUtils from '@/lib/academic-utils';

describe('First Year Coordinator ID Card Capabilities & Year-1 Scope', () => {
  const coordinatorUser = {
    id: 101,
    role: 'faculty',
    is_first_year_coordinator: true,
    branch: 'CSE'
  };

  const admissionUser = {
    id: 201,
    role: 'admission',
    name: 'Admission Clerk'
  };

  const regularFacultyUser = {
    id: 301,
    role: 'faculty',
    branch: 'ECE'
  };

  const adminUser = {
    id: 1,
    role: 'admin'
  };

  describe('IDCardAuthorizationService Coordinator Permissions', () => {
    it('grants full generation and management permissions to First Year Coordinator', () => {
      expect(IDCardAuthorizationService.canView(coordinatorUser)).toBe(true);
      expect(IDCardAuthorizationService.canPreview(coordinatorUser)).toBe(true);
      expect(IDCardAuthorizationService.canGenerate(coordinatorUser)).toBe(true);
      expect(IDCardAuthorizationService.canBulkGenerate(coordinatorUser)).toBe(true);
      expect(IDCardAuthorizationService.canManagePhotos(coordinatorUser)).toBe(true);
    });

    it('grants cross-branch access (getAllowedBranches returns null)', () => {
      expect(IDCardAuthorizationService.getAllowedBranches(coordinatorUser)).toBeNull();
      expect(IDCardAuthorizationService.isBranchAllowed(coordinatorUser, 'CSE')).toBe(true);
      expect(IDCardAuthorizationService.isBranchAllowed(coordinatorUser, 'ECE')).toBe(true);
      expect(IDCardAuthorizationService.isBranchAllowed(coordinatorUser, 'MECH')).toBe(true);
    });

    it('identifies coordinator as first-year restricted via isFirstYearOnly', () => {
      expect(IDCardAuthorizationService.isFirstYearOnly(coordinatorUser)).toBe(true);
      expect(IDCardAuthorizationService.isFirstYearOnly(admissionUser)).toBe(false);
      expect(IDCardAuthorizationService.isFirstYearOnly(adminUser)).toBe(false);
    });

    it('denies regular faculty without coordinator assignment', () => {
      expect(IDCardAuthorizationService.canView(regularFacultyUser)).toBe(false);
      expect(IDCardAuthorizationService.canGenerate(regularFacultyUser)).toBe(false);
    });
  });

  describe('IDCardDataService.isStudentFirstYear scoping', () => {
    it('identifies 1st year students correctly', async () => {
      const spy = vi.spyOn(academicUtils, 'calculateStudentYearAndSemester').mockReturnValue({
        yearOfStudy: 1,
        semester: 1
      });

      const isFirstYear = await IDCardDataService.isStudentFirstYear('240901', { academicYear: '2024-25', semester: 1 });
      expect(isFirstYear).toBe(true);
      spy.mockRestore();
    });

    it('identifies 2nd, 3rd, and 4th year students as NOT first year', async () => {
      const spy = vi.spyOn(academicUtils, 'calculateStudentYearAndSemester')
        .mockReturnValueOnce({ yearOfStudy: 2, semester: 3 })
        .mockReturnValueOnce({ yearOfStudy: 3, semester: 5 })
        .mockReturnValueOnce({ yearOfStudy: 4, semester: 7 });

      expect(await IDCardDataService.isStudentFirstYear('230901', { academicYear: '2024-25', semester: 1 })).toBe(false);
      expect(await IDCardDataService.isStudentFirstYear('220901', { academicYear: '2024-25', semester: 1 })).toBe(false);
      expect(await IDCardDataService.isStudentFirstYear('210901', { academicYear: '2024-25', semester: 1 })).toBe(false);
      spy.mockRestore();
    });
  });
});

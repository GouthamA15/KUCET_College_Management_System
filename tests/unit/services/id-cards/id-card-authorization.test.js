import { describe, it, expect } from 'vitest';
import { IDCardAuthorizationService } from '@/services/identity/IDCardAuthorizationService';
import { PERMISSIONS } from '@/lib/rbac';

describe('IDCardAuthorizationService RBAC & Scoping', () => {
  it('correctly maps ID_CARD permissions in RBAC registry', () => {
    expect(PERMISSIONS.ID_CARD_VIEW).toBe('ID_CARD_VIEW');
    expect(PERMISSIONS.ID_CARD_PREVIEW).toBe('ID_CARD_PREVIEW');
    expect(PERMISSIONS.ID_CARD_GENERATE).toBe('ID_CARD_GENERATE');
    expect(PERMISSIONS.ID_CARD_BULK_GENERATE).toBe('ID_CARD_BULK_GENERATE');
    expect(PERMISSIONS.ID_CARD_MANAGE_PHOTOS).toBe('ID_CARD_MANAGE_PHOTOS');
  });

  it('authorizes admission staff with all ID-card capabilities', () => {
    const admissionUser = { id: 101, role: 'admission', name: 'Admission Officer' };
    expect(IDCardAuthorizationService.canView(admissionUser)).toBe(true);
    expect(IDCardAuthorizationService.canPreview(admissionUser)).toBe(true);
    expect(IDCardAuthorizationService.canGenerate(admissionUser)).toBe(true);
    expect(IDCardAuthorizationService.canBulkGenerate(admissionUser)).toBe(true);
    expect(IDCardAuthorizationService.canManagePhotos(admissionUser)).toBe(true);
    expect(IDCardAuthorizationService.getAllowedBranches(admissionUser)).toBeNull(); // Unrestricted
  });

  it('authorizes super_admin and admin with unrestricted capabilities', () => {
    const adminUser = { id: 1, role: 'admin' };
    const superAdminUser = { id: 2, role: 'super_admin' };
    const principalUser = { id: 3, role: 'principal' };

    for (const u of [adminUser, superAdminUser, principalUser]) {
      expect(IDCardAuthorizationService.canView(u)).toBe(true);
      expect(IDCardAuthorizationService.canGenerate(u)).toBe(true);
      expect(IDCardAuthorizationService.canBulkGenerate(u)).toBe(true);
      expect(IDCardAuthorizationService.getAllowedBranches(u)).toBeNull();
    }
  });

  it('denies unassigned roles by default (future extensibility verification)', () => {
    const scholarshipUser = { id: 201, role: 'scholarship' };
    const facultyUser = { id: 301, role: 'faculty', branch: 'CSE' };
    const studentUser = { id: 401, role: 'student' };

    expect(IDCardAuthorizationService.canView(scholarshipUser)).toBe(false);
    expect(IDCardAuthorizationService.canGenerate(scholarshipUser)).toBe(false);

    expect(IDCardAuthorizationService.canView(facultyUser)).toBe(false);
    expect(IDCardAuthorizationService.canManagePhotos(facultyUser)).toBe(false);

    expect(IDCardAuthorizationService.canView(studentUser)).toBe(false);
  });

  it('enforces branch scoping for departmental roles', () => {
    const hodCse = { id: 501, role: 'faculty', is_hod: true, branch: 'CSE' };
    const branches = IDCardAuthorizationService.getAllowedBranches(hodCse);
    expect(branches).toEqual(['CSE']);

    expect(IDCardAuthorizationService.isBranchAllowed(hodCse, 'CSE')).toBe(true);
    expect(IDCardAuthorizationService.isBranchAllowed(hodCse, 'ECE')).toBe(false);

    expect(() => IDCardAuthorizationService.assertBranchAccess(hodCse, 'CIVIL')).toThrow(/Access Denied/);
  });
});

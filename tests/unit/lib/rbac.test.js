import { describe, it, expect } from 'vitest';
import { PERMISSIONS, hasPermission, hasAnyPermission, hasAllPermissions } from '@/lib/rbac';

describe('Enterprise RBAC', () => {
  it('should grant full permissions to admin', () => {
    expect(hasPermission('admin', PERMISSIONS.ARCHIVE_RUN)).toBe(true);
    expect(hasPermission('admin', PERMISSIONS.ARCHIVE_RESTORE)).toBe(true);
    expect(hasPermission('admin', PERMISSIONS.MARK_APPROVE)).toBe(true);
  });

  it('should grant HOD permission to approve marks and edit attendance', () => {
    expect(hasPermission('hod', PERMISSIONS.MARK_APPROVE)).toBe(true);
    expect(hasPermission('hod', PERMISSIONS.ATTENDANCE_EDIT)).toBe(true);
    expect(hasPermission('hod', PERMISSIONS.ARCHIVE_RUN)).toBe(false);
  });

  it('should restrict faculty to marking attendance and mark entry', () => {
    expect(hasPermission('faculty', PERMISSIONS.ATTENDANCE_MARK)).toBe(true);
    expect(hasPermission('faculty', PERMISSIONS.MARK_ENTRY)).toBe(true);
    expect(hasPermission('faculty', PERMISSIONS.MARK_APPROVE)).toBe(false);
    expect(hasPermission('faculty', PERMISSIONS.FEE_EDIT)).toBe(false);
  });

  it('should verify hasAnyPermission and hasAllPermissions logic', () => {
    expect(hasAnyPermission('clerk', [PERMISSIONS.FEE_VERIFY, PERMISSIONS.ARCHIVE_RUN])).toBe(true);
    expect(hasAllPermissions('clerk', [PERMISSIONS.FEE_VERIFY, PERMISSIONS.FEE_EDIT])).toBe(true);
    expect(hasAllPermissions('clerk', [PERMISSIONS.FEE_VERIFY, PERMISSIONS.ARCHIVE_RUN])).toBe(false);
  });
});

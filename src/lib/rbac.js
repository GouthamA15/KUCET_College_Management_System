export const PERMISSIONS = Object.freeze({
  ATTENDANCE_MARK: 'ATTENDANCE_MARK',
  ATTENDANCE_EDIT: 'ATTENDANCE_EDIT',
  MARK_ENTRY: 'MARK_ENTRY',
  MARK_APPROVE: 'MARK_APPROVE',
  FEE_VERIFY: 'FEE_VERIFY',
  FEE_EDIT: 'FEE_EDIT',
  CERTIFICATE_APPROVE: 'CERTIFICATE_APPROVE',
  ARCHIVE_RUN: 'ARCHIVE_RUN',
  ARCHIVE_RESTORE: 'ARCHIVE_RESTORE',
  REPORT_EXPORT: 'REPORT_EXPORT',
  VIEW_OWN_RECORDS: 'VIEW_OWN_RECORDS',
});

export const DEFAULT_ROLE_PERMISSIONS = Object.freeze({
  admin: Object.values(PERMISSIONS),
  super_admin: Object.values(PERMISSIONS),
  principal: Object.values(PERMISSIONS),
  hod: [
    PERMISSIONS.ATTENDANCE_MARK,
    PERMISSIONS.ATTENDANCE_EDIT,
    PERMISSIONS.MARK_ENTRY,
    PERMISSIONS.MARK_APPROVE,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.VIEW_OWN_RECORDS,
  ],
  faculty: [
    PERMISSIONS.ATTENDANCE_MARK,
    PERMISSIONS.MARK_ENTRY,
    PERMISSIONS.VIEW_OWN_RECORDS,
  ],
  admission: [
    PERMISSIONS.CERTIFICATE_APPROVE,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.VIEW_OWN_RECORDS,
  ],
  scholarship: [
    PERMISSIONS.FEE_VERIFY,
    PERMISSIONS.FEE_EDIT,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.VIEW_OWN_RECORDS,
  ],
  staff: [
    PERMISSIONS.VIEW_OWN_RECORDS,
  ],
  student: [
    PERMISSIONS.VIEW_OWN_RECORDS,
  ],
});

/**
 * Resolves permissions for a user role
 */
export function getRolePermissions(role) {
  if (!role) return [];
  const normalizedRole = String(role).toLowerCase();
  return DEFAULT_ROLE_PERMISSIONS[normalizedRole] || [];
}

/**
 * Checks if a role has a specific permission
 */
export function hasPermission(role, permission) {
  const permissions = getRolePermissions(role);
  return permissions.includes(permission);
}

/**
 * Checks if a role has ANY of the specified permissions
 */
export function hasAnyPermission(role, permissions = []) {
  const rolePermissions = getRolePermissions(role);
  return permissions.some((perm) => rolePermissions.includes(perm));
}

/**
 * Checks if a role has ALL of the specified permissions
 */
export function hasAllPermissions(role, permissions = []) {
  const rolePermissions = getRolePermissions(role);
  return permissions.every((perm) => rolePermissions.includes(perm));
}

import { PERMISSIONS, hasPermission } from '@/lib/rbac';

/**
 * IDCardAuthorizationService
 * Reusable role-based and branch-scoped authorization service for ID card features.
 * Extensible to any staff role (Admission, Scholarship, Faculty, HOD, Principal, Admin).
 */
export class IDCardAuthorizationService {
  /**
   * Check if user has permission to view the ID card management hub and search records
   */
  static canView(user) {
    if (!user || !user.role) return false;
    return hasPermission(user.role, PERMISSIONS.ID_CARD_VIEW);
  }

  /**
   * Check if user can preview an individual student's ID card
   */
  static canPreview(user) {
    if (!user || !user.role) return false;
    return hasPermission(user.role, PERMISSIONS.ID_CARD_PREVIEW);
  }

  /**
   * Check if user can generate and download an individual student's ID card PDF
   */
  static canGenerate(user) {
    if (!user || !user.role) return false;
    return hasPermission(user.role, PERMISSIONS.ID_CARD_GENERATE);
  }

  /**
   * Check if user can batch-generate bulk ID cards
   */
  static canBulkGenerate(user) {
    if (!user || !user.role) return false;
    return hasPermission(user.role, PERMISSIONS.ID_CARD_BULK_GENERATE);
  }

  /**
   * Check if user can upload, replace or rectify student ID photographs
   */
  static canManagePhotos(user) {
    if (!user || !user.role) return false;
    return hasPermission(user.role, PERMISSIONS.ID_CARD_MANAGE_PHOTOS);
  }

  /**
   * Resolves the list of authorized branches for the given user.
   * Returns `null` if the user has unrestricted global access across all branches.
   * Returns an array of uppercase branch strings (e.g. `['CSE']`) if scoped.
   */
  static getAllowedBranches(user) {
    if (!user || !user.role) return [];

    const role = String(user.role).toLowerCase();

    // Global administrative & admission roles have complete cross-branch access
    if (['super_admin', 'admin', 'principal', 'admission'].includes(role)) {
      return null; // unrestricted
    }

    // HODs or departmental faculty have access restricted to their assigned branch(es)
    if (user.branch) {
      return [String(user.branch).toUpperCase()];
    }

    if (user.department_code) {
      return [String(user.department_code).toUpperCase()];
    }

    // Default restricted
    return [];
  }

  /**
   * Validates whether the user is authorized to view or generate cards for a specific branch
   */
  static isBranchAllowed(user, branch) {
    const allowed = this.getAllowedBranches(user);
    if (allowed === null) return true; // unrestricted
    if (!branch) return true;
    return allowed.includes(String(branch).toUpperCase());
  }

  /**
   * Asserts branch access; throws standard error if forbidden
   */
  static assertBranchAccess(user, branch) {
    if (!this.isBranchAllowed(user, branch)) {
      const error = new Error(`Access Denied: You do not have permissions for branch ${branch}`);
      error.statusCode = 403;
      throw error;
    }
  }
}

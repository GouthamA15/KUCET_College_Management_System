# Session 207: Hard Clerk → Staff Migration (Zero Backward Compatibility)

**Date:** August 22, 2026  
**System Version:** Session 207 (testvanilla)  
**Status:** Completed & Verified (49/49 Test Files Passed, 356/356 Unit Tests Passed, Next.js 16 Production Build 203/203 Routes Clean)  
**Architectural Policy:** 100% Zero Backward Compatibility with Clerk

---

## 1. Executive Summary

In Session 207, the **KUCET College Management System** executed a **hard breaking architectural migration** eliminating all legacy `clerk` concepts, database tables, schemas, session models, cookies, role aliases, contexts, UI components, and API routes. The unified institutional identity model is now **`staff`**, supporting distinct umbrella sub-roles: **Faculty**, **Admission Staff**, and **Scholarship Staff**, with dedicated HOD resolution via `faculty_hod_assignments`.

In accordance with institutional directives, **zero backward compatibility** was retained for legacy clerk sessions, cookies, or database fallbacks. Old sessions are rejected, requiring fresh authentication against the canonical `staff_accounts` schema.

---

## 2. Core Architectural Changes

### 2.1 Database Schema (`src/db/schema/identity.js`, `operations.js`, `security.js`)
- **Permanently Removed Tables**: `clerks`, `clerk_registration_requests`.
- **Canonical Schema**:
  - `staff_accounts`: Canonical identity table storing `id`, `name`, `email`, `employee_id`, `password_hash`, `account_status` (`PENDING_ACTIVATION`, `ACTIVE`, `SUSPENDED`, `INACTIVE`), `mobile_hash`, `pfp`, `signature`, `created_at`, `updated_at`.
  - `staff_roles`: Lookup table (`FACULTY`, `ADMISSION_CLERK`, `SCHOLARSHIP_CLERK`, `EXAM_BRANCH`, `HOD`).
  - `staff_account_roles`: Relational mapping of `staff_account_id` → `role_id`.
  - `staff_academic_affiliations`: Academic department linkages (`staff_account_id`, `department_id`, `designation`).
  - `staff_account_activation_tokens`: Cryptographic activation tokens for self-onboarded staff.
  - `faculty_hod_assignments`: Sole source of truth for HOD branch assignments (`faculty_id`, `department_id`, `is_active`).
  - `staff_registration_requests`: Pending public registration requests with email OTP verification.
- **Operations & Security Schema**:
  - `student_requests`: Actions tracked as `action_by_staff_id`, `action_by_staff_name`, `action_by_staff_email`.
  - `student_history`: Tracked with `staff_id`, `staff_name`, `staff_email`.
  - `user_sessions` & `audit_logs`: User type strictly `STAFF`, `ADMIN`, or `STUDENT`.
  - `storage_folders`: Canonical folder keys updated from `clerks/pfp` → `staff/pfp`.

### 2.2 Authentication & Authorization (`src/proxy.js`, `src/lib/auth-utils.js`, `src/lib/rbac.js`, `src/lib/api-utils.js`)
- **Cookie Model**:
  - Replaced `clerk_auth`, `clerk_refresh`, `clerk_logged_in` with `staff_auth`, `staff_refresh`, `staff_logged_in`.
  - Raw array buffering via `newCookiesToSet` in Edge proxy preserved.
- **Role Isolation & RBAC**:
  - Roles strictly typed as: `admin`, `hod`, `faculty`, `admission`, `scholarship`, `student`.
  - Explicit role boundaries enforced on API routes via `wrapHandler` and `authorizeStaffRole`.
  - Admission Staff access strictly to `/api/staff/admission/*`, `/api/staff/students/*`, `/staff/admission/*`.
  - Scholarship Staff access strictly to `/api/staff/scholarship/*`, `/staff/scholarship/*`.
  - Faculty/HOD access strictly to `/api/staff/faculty/*`, `/api/staff/hod/*`, `/staff/faculty/*`, `/staff/hod/*`.
  - No generic or alias fallbacks.

### 2.3 Frontend Context & Component Hierarchy
- **Context**: `StaffContext.js` replaces `ClerkContext.js`.
  - Exposes `staffData`, `setStaffData`, `refreshStaffData`, `pendingProfileRequests`, `pendingCertificateRequests`, `facultyAssignments`, `hodBranchData`.
  - Removed all `clerkData` aliases and backward compatibility bridges.
- **Component Renames & Replacements**:
  - `StaffStudentManagement.js` created; legacy `ClerkStudentManagement.js` deleted.
  - `StaffNotificationDropdown.js` & `StaffTopBar.js` created; legacy clerk variants deleted.
  - `StaffDashboardSkeleton.js` standardized across all staff dashboards.
  - `HODConsole.js`, `StudentHistoryCard.js`, `CertificateDashboard.js`, `CertificateActionPanel.js` updated to consume `staffData` and `currentStaffId`.
  - `Navbar.js` & `Sidebar.js` updated for role navigation (`open-panel-staff`, `staffData`).
  - Layout: `src/app/staff/layout.js` updated to `StaffLayout` with `role="staff"`.

### 2.4 API Routes Standardized (`src/app/api/staff/*`)
- All 35+ API routes under `src/app/api/staff/` standardized to:
  - Extract session identity via `user.staffId || user.id`.
  - Validate role permissions strictly using domain-scoped schemas.
  - Audit logging using `user_type: 'STAFF'` and `user_id: staff.id`.
  - Zero reference to legacy clerk parameters or request bodies.

---

## 3. Verification & Compliance Matrix

| Verification Check | Result | Details |
| :--- | :--- | :--- |
| **Unit Test Suite** | ✅ **PASSED** (49/49 files, 356/356 tests) | All RBAC, Auth, Forensics, Services, and Storage tests pass. |
| **Next.js Production Build** | ✅ **PASSED** (203/203 routes) | Turbopack compilation succeeded with 0 TypeScript/ESM/RSC errors. |
| **Zero Backward Compatibility** | ✅ **VERIFIED** | No `COALESCE(staff_id, clerk_id)`, no `if (role === 'clerk')`, no legacy cookies. |
| **Edge Proxy Cookie Buffering** | ✅ **VERIFIED** | Raw `newCookiesToSet` array preserved for multi-role session isolation. |
| **Cloudinary & Storage Invariants** | ✅ **VERIFIED** | Relative storage keys (`staff/pfp/*`) and `getAssetUrl()` cache layer enforced. |

---

## 4. Migration Sign-off

The system is fully migrated, verified, and ready for deployment to the `testvanilla` and `main` branches.

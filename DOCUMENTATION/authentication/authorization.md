# Authorization System & Role-Based Access Control (RBAC)

## Overview

The KUCET CMS employs a fine-grained Role-Based Access Control (RBAC) framework designed to enforce principle of least privilege across all user roles. The system enforces authorization at two independent layers:
1. **Edge Middleware (`src/proxy.js`)**: Evaluates incoming request paths, user JWT tokens, and role credentials to block unauthorized HTTP access before hitting server controllers.
2. **Application Level (`src/lib/rbac.js`)**: Evaluates programmatic permissions for server actions, API route handlers, and UI component rendering.

---

## Fine-Grained RBAC Permission Matrix

All permissions in the system are explicitly enumerated in the `PERMISSIONS` dictionary ([`src/lib/rbac.js`](file:///run/media/admino/New%20Volume/User/Desktop/CMS/src/lib/rbac.js)):

```javascript
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
  ID_CARD_VIEW: 'ID_CARD_VIEW',
  ID_CARD_PREVIEW: 'ID_CARD_PREVIEW',
  ID_CARD_GENERATE: 'ID_CARD_GENERATE',
  ID_CARD_BULK_GENERATE: 'ID_CARD_BULK_GENERATE',
  ID_CARD_MANAGE_PHOTOS: 'ID_CARD_MANAGE_PHOTOS',
});
```

---

## Role Hierarchy & Mapping

The `DEFAULT_ROLE_PERMISSIONS` dictionary maps institutional roles to their granted permissions:

| Permission Name | Super Admin / Principal | HOD | Faculty | First-Year Coordinator | Admission Staff | Scholarship Staff | General Staff | Student |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `ATTENDANCE_MARK` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `ATTENDANCE_EDIT` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `MARK_ENTRY` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `MARK_APPROVE` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `FEE_VERIFY` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `FEE_EDIT` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `CERTIFICATE_APPROVE` | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `ARCHIVE_RUN` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `ARCHIVE_RESTORE` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `REPORT_EXPORT` | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| `VIEW_OWN_RECORDS` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `ID_CARD_VIEW` | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `ID_CARD_PREVIEW` | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `ID_CARD_GENERATE` | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `ID_CARD_BULK_GENERATE` | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `ID_CARD_MANAGE_PHOTOS` | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## Helper API & Evaluation Utility

The system provides synchronous evaluation utilities for checking permissions in server actions and UI components (`src/lib/rbac.js`):

### 1. `getRolePermissions(role)`
Normalizes the role string to lowercase and retrieves the array of granted permissions. Returns an empty array `[]` for unknown or missing roles.

### 2. `hasPermission(role, permission)`
Returns `true` if the specified role possesses the target permission.
```javascript
import { hasPermission, PERMISSIONS } from '@/lib/rbac';

if (!hasPermission(user.role, PERMISSIONS.ATTENDANCE_EDIT)) {
  throw new Error('Forbidden: Insufficient privileges to edit attendance.');
}
```

### 3. `hasAnyPermission(role, permissionsArray)`
Returns `true` if the specified role possesses **at least one** of the permissions listed in `permissionsArray`.

### 4. `hasAllPermissions(role, permissionsArray)`
Returns `true` if the specified role possesses **all** of the permissions listed in `permissionsArray`.

---

## Middleware Baseline Enforcement (`src/proxy.js`)

The Edge proxy middleware sits in front of all HTTP routes (except static assets and public auth endpoints) and enforces strict route boundaries based on JWT claims.

```mermaid
graph TD
    A[Incoming HTTP Request] --> B{Path Prefix?}
    
    B -->|/admin/*| C{admin_auth valid?}
    C -->|Yes| D[Allow Request]
    C -->|No| E[Redirect to / or 401 API Error]
    
    B -->|/staff/*| F{staff_auth valid?}
    F -->|No| E
    F -->|Yes| G{Subpath Check}
    G -->|/staff/scholarship| H{role === 'scholarship'?}
    G -->|/staff/admission| I{role === 'admission' / 1st-Yr ID Cards?}
    G -->|/staff/faculty| J{role === 'faculty'?}
    G -->|/staff/hod| K{role === 'faculty' && (is_hod || is_principal)?}
    G -->|/staff/first-year| L{role === 'faculty' && (is_first_year_coordinator || is_principal)?}
    H -->|Yes| D
    I -->|Yes| D
    J -->|Yes| D
    K -->|Yes| D
    L -->|Yes| D
    H & I & J & K & L -->|No| M[Redirect to Authorized Role Dashboard]
    
    B -->|/student/*| N{student_auth valid?}
    N -->|No| E
    N -->|Yes| O{Email & Password Verified?}
    O -->|Yes| D
    O -->|No| P{Allowed Unverified Route?}
    P -->|/student, /settings/security, /profile, /apaar| D
    P -->|Other /student/*| Q[Redirect to /student/settings/security]
```

### Route Defense Specifications
1. **Admin Routes (`/admin/*`, `/api/admin/*`)**: Strictly requires a valid `admin_auth` cookie containing `role: 'admin'`.
2. **Staff Routes (`/staff/*`, `/api/staff/*`)**: Requires a valid `staff_auth` cookie. Sub-route checking ensures role segregation:
   - `/staff/scholarship/*` restricts to `scholarship` staff.
   - `/staff/admission/*` restricts to `admission` staff (or First-Year Coordinators for `/staff/admission/id-cards`).
   - `/staff/faculty/*` restricts to `faculty` staff.
   - `/staff/hod/*` requires `role === 'faculty'` AND (`is_hod === true` or `is_principal === true`).
   - `/staff/first-year/*` requires `role === 'faculty'` AND (`is_first_year_coordinator === true` or `is_principal === true`).
3. **Student Routes (`/student/*`)**: Requires `student_auth`. Unverified students (who haven't set up passwords or verified email) are restricted exclusively to `/student`, `/student/profile`, `/student/apaar`, and `/student/settings/security`. Any attempt to access `/student/academics`, `/student/finances`, or certificate applications redirects to `/student/settings/security`.


---

## Cross-References

- [Authentication Architecture](./authentication.md)
- [Session Management](./session-management.md)
- [Staff Portal Documentation](../pages/staff-pages.md)
- [HOD Console Documentation](../pages/hod-pages.md)

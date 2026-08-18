# Session 207 (testvanilla) — Complete Change Analysis & Engineering Reference

**Branch:** `testvanilla`  
**Base:** `main` (after Session 206 merge)  
**Commits:** 6 commits ahead · `21b2fb07..08b10a4c`  
**Analysis Date:** August 18, 2026  
**Authors:** GouthamA15 · P.Sannith  
**Scale:** 212 files changed · ~3,500 net insertions

---

## Executive Summary

Session 207 is the **most architecturally significant change** in the KUCET CMS history. It delivers two independent but related transformations:

1. **A brand-new 4-stage Staff Onboarding & Activation System** — email OTP verification → form submission → admin approval → token-based password setup — backed by 8 new database tables and a dedicated multi-step registration wizard.

2. **A complete system-wide rename from `clerk` → `staff`** across 212 files covering every layer: URL routes, API endpoints, React pages, components, context, auth cookies, JWT claims, token refresh logic, services, middleware, and tests.

This is a **breaking change** for all existing sessions: any `clerk_auth` cookie is invalidated on deploy and all staff users must re-login.

---

## Table of Contents

1. [Commit Log Summary](#1-commit-log-summary)
2. [Database Schema — Complete New Table Definitions](#2-database-schema--complete-new-table-definitions)
3. [Database Schema — Modified Tables](#3-database-schema--modified-tables)
4. [Required Database Migrations & Seeds](#4-required-database-migrations--seeds)
5. [New Feature: Staff Onboarding Pipeline (4-Stage Workflow)](#5-new-feature-staff-onboarding-pipeline-4-stage-workflow)
6. [New API Endpoints — Complete Reference](#6-new-api-endpoints--complete-reference)
7. [Global clerk → staff Rename — Every Layer](#7-global-clerk--staff-rename--every-layer)
8. [Authentication Layer — Full Changes](#8-authentication-layer--full-changes)
9. [New UI Pages & Components](#9-new-ui-pages--components)
10. [Services Layer — Detailed Changes](#10-services-layer--detailed-changes)
11. [Middleware, Proxy & Route Protection](#11-middleware-proxy--route-protection)
12. [Admin Console Changes](#12-admin-console-changes)
13. [Core Library Changes](#13-core-library-changes)
14. [Build & Deployment — Memory Optimizations](#14-build--deployment--memory-optimizations)
15. [Test Suite Changes](#15-test-suite-changes)
16. [Files Deleted](#16-files-deleted)
17. [Full File Manifest](#17-full-file-manifest)
18. [Deployment Checklist](#18-deployment-checklist)

---

## 1. Commit Log Summary

| # | Hash | Message | Files | Key Impact |
|---|---|---|---|---|
| 1 | `8b9d4e4c` | Staff Registration and Admin Approval Workflow | 14 new files, ~1,957 lines | New DB tables, public + admin APIs, registration wizard UI |
| 2 | `b66c8899` | Staff account token verification + password setup | 12 files, +650 lines | Activation route, PasswordSetupClient, schema refinements |
| 3 | `dc3cfe02` | Admin approval + token + password setup (Working Module) | 6 files, +190 lines | Polish: password strength meter, route hardening |
| 4 | `7957f29f` | No merge conflicts dw | merge | Conflict resolution |
| 5 | `a8b68155` | Migration (clerk to staff) — Implemented working module | 212 files, 1,566 ins / 2,483 del | **Global clerk→staff rename across all layers** |
| 6 | `08b10a4c` | Memory Free deployment + Test CI/CD | 6 files | Build memory fix, admin manage-clerks refactor, E2E test updates |
| 7 | `a8a350c3` | Admin Staff Management Continuation | Scaffolding | Base scaffolding for unified staff management |
| 8 | `5ab9ff0f` | Admin Staff Management & Staff Edit Profile | 18 files | Full `/admin/manage-staff`, `/staff/settings/edit-profile`, `faculty_hod_assignments` |
| 9 | `916cb472` | CI/CD Asset Normalization Fix | 1 file | Pass-through data URIs, relative key extraction, bounded cache |
| 10 | `92854eae` | Unified HOD Resolution Across Auth Pipeline | 4 files | Unified HOD resolution in login, /api/staff/me, and token refresh |
| 11 | `b83155a8` | Solutions Architecture & Next.js Audit Report | 1 file | Comprehensive RSC, server actions, and frontend audit |
| 12 | `cfa6b7d8` | Staff Soft Deactivation & Reactivation | 2 files | Soft deactivation (`SUSPENDED`) instead of hard deletion to preserve history |

---

## 2. Database Schema — Complete New Table Definitions

> All new tables are in `src/db/schema/identity.js` and `src/db/schema/academic.js`.  
> **Migration required** — run `npm run db:generate` then `npm run db:migrate`.

---

### 2.1 `staff_accounts` — Unified Staff Identity Table

Replaces the `clerks` table as the canonical identity store for all new staff registered through the new onboarding pipeline.

```javascript
// src/db/schema/identity.js
export const staffAccounts = mysqlTable('staff_accounts', {
  id:             int('id').autoincrement().primaryKey().notNull(),
  name:           varchar('name', { length: 255 }).notNull(),
  email:          varchar('email', { length: 255 }).notNull(),
  employee_id:    varchar('employee_id', { length: 255 }).notNull(),
  password_hash:  varchar('password_hash', { length: 255 }),       // null until activation
  staff_category: varchar('staff_category', { length: 50 }).notNull(),  // 'FACULTY' | 'NON_TEACHING'
  designation:    varchar('designation', { length: 100 }).notNull(),
  mobile_hash:    varchar('mobile_hash', { length: 64 }),           // blind index for search
  pfp:            text('pfp'),                                      // relative storage key
  signature:      text('signature'),                                // relative storage key
  address:        text('address'),
  account_status: mysqlEnum('account_status', [
                    'PENDING_ACTIVATION',
                    'ACTIVE',
                    'SUSPENDED'
                  ]).default('PENDING_ACTIVATION').notNull(),
  created_at:     timestamp('created_at').defaultNow(),
  updated_at:     timestamp('updated_at').onUpdateNow(),
}, (table) => ({
  emailIdx:      uniqueIndex('idx_staff_email').on(table.email),
  employeeIdIdx: uniqueIndex('idx_staff_employee_id').on(table.employee_id),
}));
```

**Key differences from `clerks` table:**
| Field | `clerks` (old) | `staff_accounts` (new) |
|---|---|---|
| Status field | `is_active` (boolean) | `account_status` enum |
| Role storage | `role` column directly | Separate `staff_account_roles` table |
| Branch storage | `branch` column | Separate `staff_academic_affiliations` table |
| HOD flag | `is_hod` column | `staff_academic_affiliations.is_hod` |
| Mobile | `mobile` (encrypted) | `mobile_hash` only (blind index) |
| Password | `must_change_password` flag | `account_status = PENDING_ACTIVATION` |

---

### 2.2 `staff_roles` — Role Lookup Table

Canonical list of valid staff role codes. Prevents hardcoded strings across the codebase.

```javascript
export const staffRoles = mysqlTable('staff_roles', {
  id:          int('id').autoincrement().primaryKey().notNull(),
  role_code:   varchar('role_code', { length: 50 }).notNull().unique('uq_staff_roles_code'),
  description: text('description'),
  created_at:  timestamp('created_at').defaultNow(),
});
```

**Seed data required:**
```sql
INSERT INTO staff_roles (role_code, description) VALUES
  ('FACULTY',           'Teaching staff — course management and attendance'),
  ('ADMISSION_CLERK',   'Manages student admissions and enrollment records'),
  ('SCHOLARSHIP_CLERK', 'Manages scholarship applications and payment records');
```

---

### 2.3 `staff_account_roles` — Staff ↔ Role Junction

Many-to-many between `staff_accounts` and `staff_roles`. Allows future multi-role assignment.

```javascript
export const staffAccountRoles = mysqlTable('staff_account_roles', {
  id:               int('id').autoincrement().primaryKey().notNull(),
  staff_account_id: int('staff_account_id').notNull(),     // FK → staff_accounts.id
  role_id:          int('role_id').notNull(),              // FK → staff_roles.id
  assigned_at:      timestamp('assigned_at').defaultNow(),
  assigned_by:      int('assigned_by'),                    // FK → principal.id (nullable)
}, (table) => ({
  staffIdIdx: index('idx_staff_account_roles_staff').on(table.staff_account_id),
  roleIdx:    index('idx_staff_account_roles_role').on(table.role_id),
}));
```

---

### 2.4 `staff_academic_affiliations` — Faculty Department/Program Links

Replaces the flat `branch` string column on `clerks`. Allows faculty to be affiliated to multiple programs within a department.

```javascript
export const staffAcademicAffiliations = mysqlTable('staff_academic_affiliations', {
  id:               int('id').autoincrement().primaryKey().notNull(),
  staff_account_id: int('staff_account_id').notNull(),   // FK → staff_accounts.id
  department_id:    int('department_id').notNull(),      // FK → academic_departments.id
  program_id:       int('program_id'),                   // FK → academic_programs.id (nullable)
  is_hod:           boolean('is_hod').default(false),    // HOD flag per department
  created_at:       timestamp('created_at').defaultNow(),
}, (table) => ({
  staffIdIdx:  index('idx_staff_affil_id').on(table.staff_account_id),
  deptProgIdx: index('idx_staff_affil_dept_prog').on(table.department_id, table.program_id),
}));
```

---

### 2.5 `staff_account_activation_tokens` — Secure One-Time Activation Links

Stores SHA-256 hashed activation tokens sent via email. Raw token is never stored.

```javascript
export const staffAccountActivationTokens = mysqlTable('staff_account_activation_tokens', {
  id:               int('id').autoincrement().primaryKey().notNull(),
  staff_account_id: int('staff_account_id').notNull(),   // FK → staff_accounts.id
  token_hash:       varchar('token_hash', { length: 255 }).notNull(),  // SHA-256 of raw token
  expires_at:       timestamp('expires_at').notNull(),   // 48 hours from creation
  used_at:          timestamp('used_at'),                // set on successful activation
  created_at:       timestamp('created_at').defaultNow(),
}, (table) => ({
  tokenHashIdx: uniqueIndex('idx_staff_activation_token').on(table.token_hash),  // unique
  staffIdIdx:   index('idx_staff_activation_staff').on(table.staff_account_id),
}));
```

**Security design:** The `token_hash` index is `uniqueIndex` — preventing any two active tokens sharing the same hash. Resending activation generates a new `crypto.randomBytes(32)` token, hashes it, and inserts a new row.

---

### 2.6 `academic_departments` — Institutional Department Registry

New table in `src/db/schema/academic.js`. Provides validated department data for the registration wizard.

```javascript
export const academicDepartments = mysqlTable('academic_departments', {
  id:              int('id').autoincrement().primaryKey().notNull(),
  department_code: varchar('department_code', { length: 50 }).notNull().unique(),
  department_name: varchar('department_name', { length: 255 }).notNull(),
  is_active:       boolean('is_active').default(true),
  created_at:      timestamp('created_at').defaultNow(),
  updated_at:      timestamp('updated_at').onUpdateNow(),
});
```

**Example seed data needed:**
```sql
INSERT INTO academic_departments (department_code, department_name) VALUES
  ('CSE',   'Computer Science & Engineering'),
  ('ECE',   'Electronics & Communication Engineering'),
  ('MECH',  'Mechanical Engineering'),
  ('CIVIL', 'Civil Engineering'),
  ('EEE',   'Electrical & Electronics Engineering'),
  ('IT',    'Information Technology');
```

---

### 2.7 `academic_programs` — Programs/Courses Per Department

Sub-programs offered by each department. Faculty select these during registration.

```javascript
export const academicPrograms = mysqlTable('academic_programs', {
  id:            int('id').autoincrement().primaryKey().notNull(),
  department_id: int('department_id').notNull(),            // FK → academic_departments.id
  program_code:  varchar('program_code', { length: 50 }).notNull().unique(),
  program_name:  varchar('program_name', { length: 255 }).notNull(),
  is_active:     boolean('is_active').default(true),
  created_at:    timestamp('created_at').defaultNow(),
  updated_at:    timestamp('updated_at').onUpdateNow(),
}, (table) => ({
  deptIdx: index('idx_academic_programs_dept').on(table.department_id),
}));
```

---

## 3. Database Schema — Modified Tables

### 3.1 `staff_registration_requests` (Renamed + Extended)

**Was:** `clerk_registration_requests`  
**Now:** `staff_registration_requests`

Full column diff:

| Column | Action | Before → After |
|---|---|---|
| `employee_id` | Modified | `NOT NULL` → `nullable` (assigned on approval, not registration) |
| `staff_category` | Modified | `NOT NULL DEFAULT 'FACULTY'` → `nullable` |
| `branch` | **Removed** | Replaced by `academic_affiliations` JSON |
| `department` | **Removed** | Replaced by `academic_affiliations` JSON |
| `mobile` | **Removed** | Encrypted mobile column removed entirely |
| `mobile_hash` | Kept | Blind searchable index for mobile |
| `requested_role` | **Added** | `varchar(50)` — `'FACULTY'` / `'ADMISSION_CLERK'` / `'SCHOLARSHIP_CLERK'` |
| `academic_affiliations` | **Added** | `json` — `[{department_code, program_codes[]}]` |
| `email_verified_at` | **Added** | `timestamp` — set when OTP is verified successfully |

```javascript
// New shape after Session 207
export const staffRegistrationRequests = mysqlTable('staff_registration_requests', {
  id:                   int('id').autoincrement().primaryKey().notNull(),
  name:                 varchar('name', { length: 255 }).notNull(),
  email:                varchar('email', { length: 255 }).notNull(),
  employee_id:          varchar('employee_id', { length: 255 }),        // nullable
  staff_category:       varchar('staff_category', { length: 50 }),      // nullable
  requested_role:       varchar('requested_role', { length: 50 }),      // NEW
  academic_affiliations: json('academic_affiliations'),                  // NEW: [{department_code, program_codes[]}]
  designation:          varchar('designation', { length: 100 }),
  mobile_hash:          varchar('mobile_hash', { length: 64 }),
  email_verified_at:    timestamp('email_verified_at'),                  // NEW
  pfp:                  text('pfp'),
  signature:            text('signature'),
  status:               mysqlEnum('status', ['PENDING', 'APPROVED', 'REJECTED']).default('PENDING').notNull(),
  admin_notes:          text('admin_notes'),
  created_at:           timestamp('created_at').defaultNow(),
  updated_at:           timestamp('updated_at').onUpdateNow(),
});
```

### 3.2 `src/db/schema/academic.js` — Import Change

```javascript
// Added json to imports
import { mysqlTable, varchar, int, boolean, text, timestamp,
         mysqlEnum, bigint, index, uniqueIndex, date, json } from 'drizzle-orm/mysql-core';
```

### 3.3 Minor Schema Updates

| Schema File | Change |
|---|---|
| `operations.js` | `clerks` table references in queries → `staffAccounts` |
| `registry.js` | Clerk-linked imports updated |
| `security.js` | `push_subscriptions.user_type` validation updated to accept `'staff'` |

---

## 4. Required Database Migrations & Seeds

> ⚠️ **Do NOT use `npm run db:push`** — always use the Drizzle 4-step migration standard.

```bash
# Step 1: Generate SQL migration from schema changes
npm run db:generate

# Step 2: Review the generated SQL in /drizzle/
# Verify: CREATE TABLE staff_accounts, staff_roles, staff_account_roles,
#          staff_academic_affiliations, staff_account_activation_tokens,
#          academic_departments, academic_programs
# Verify: RENAME TABLE clerk_registration_requests → staff_registration_requests
#         + ALTER TABLE (add requested_role, academic_affiliations, email_verified_at)
#         + ALTER TABLE (drop branch, department, mobile columns)

# Step 3: Apply migration
npm run db:migrate
```

**Required seed SQL after migration:**

```sql
-- 1. Seed staff roles lookup
INSERT INTO staff_roles (role_code, description) VALUES
  ('FACULTY',           'Teaching staff — course and attendance management'),
  ('ADMISSION_CLERK',   'Manages student admissions and enrollment records'),
  ('SCHOLARSHIP_CLERK', 'Manages scholarship applications and payment records');

-- 2. Seed academic departments
INSERT INTO academic_departments (department_code, department_name, is_active) VALUES
  ('CSE',   'Computer Science & Engineering', 1),
  ('ECE',   'Electronics & Communication Engineering', 1),
  ('MECH',  'Mechanical Engineering', 1),
  ('CIVIL', 'Civil Engineering', 1),
  ('EEE',   'Electrical & Electronics Engineering', 1),
  ('IT',    'Information Technology', 1);

-- 3. Seed academic programs (example for CSE)
INSERT INTO academic_programs (department_id, program_code, program_name) VALUES
  (1, 'BTECH-CSE', 'B.Tech Computer Science & Engineering'),
  (1, 'MTECH-CSE', 'M.Tech Computer Science & Engineering');
-- (Repeat for all departments)
```

**Cookie invalidation:** All existing `clerk_auth` browser sessions are invalidated on deployment. Communicate to all staff users to log in again.

---

## 5. New Feature: Staff Onboarding Pipeline (4-Stage Workflow)

This replaces the previous simple self-registration system. The new pipeline is formal, auditable, and admin-controlled.

### Stage 1 — Email OTP Verification

**Entry point:** `POST /api/public/staff-registration/email/send-otp`

```
Request:  { email: "staff@kucet.ac.in" }

Server actions:
  1. Validate email format (Zod)
  2. Check not already in clerks/staffAccounts tables (409 if exists)
  3. Generate 6-digit OTP using crypto.randomInt(100000, 999999)
  4. Store OTP in memory/Redis with 10-minute TTL
  5. Send OTP via sendInstitutionalEmail()
  6. Return: { success: true, message: "OTP sent" }
```

**Verify OTP:** `POST /api/public/staff-registration/email/verify-otp`

```
Request:  { email, otp }

Server actions:
  1. Look up OTP record for email
  2. Validate OTP matches + not expired
  3. Delete OTP record (single-use)
  4. Sign a short-lived JWT:
     { verifiedEmail: email, purpose: 'staff_registration_email' }
     (signed with JWT_SECRET, 30-minute expiry)
  5. Return: { success: true, verificationToken: "<jwt>" }
```

The `verificationToken` is passed to Stage 2 to prove email was verified.

---

### Stage 2 — Registration Form Submission

**Endpoint:** `POST /api/public/staff-registration`

**Zod schema:**
```javascript
z.object({
  fullName:              z.string().min(1),
  email:                 z.string().email(),
  mobile:                z.string().regex(/^\d{10}$/),
  requested_role:        z.enum(['FACULTY', 'ADMISSION_CLERK', 'SCHOLARSHIP_CLERK']),
  designation:           z.string().min(1),
  verificationToken:     z.string().min(1),   // JWT from Stage 1
  academic_affiliations: z.array(z.object({
    department_code: z.string(),
    program_codes:   z.array(z.string())
  })).optional().default([])
})
```

**Server validation pipeline:**
```
1. Zod schema validation
2. Verify JWT token:
   - Decode with JWT_SECRET
   - payload.verifiedEmail must match submitted email (case-insensitive)
   - payload.purpose must be 'staff_registration_email'
   - If invalid/expired → 400 "Invalid or expired email verification token"

3. Role-based academic validation:
   IF requested_role === 'FACULTY':
     - academic_affiliations must not be empty
     - affil[0].department_code must not be empty
     - affil[0].program_codes must have at least 1 entry
     - Validate department_code exists in academic_departments (is_active=true)
     - Validate each program_code exists in academic_programs for that department
   ELSE:
     - academic_affiliations must be empty (non-faculty cannot have affiliations)

4. Duplicate protection:
   - Check clerks table by email (existing active account → 409)
   - Check staffAccounts table by email (409 if exists)
   - Check staffRegistrationRequests by email:
       PENDING  → 409 "Request already pending"
       APPROVED → 409 "Already approved"
       REJECTED → 409 "Previously rejected"

5. Map role to category:
   FACULTY          → staff_category: 'FACULTY'
   ADMISSION_CLERK  → staff_category: 'NON_TEACHING'
   SCHOLARSHIP_CLERK → staff_category: 'NON_TEACHING'

6. Insert into staffRegistrationRequests:
   { name, email, staff_category, requested_role, designation,
     mobile_hash: hashForIndex(mobile), academic_affiliations,
     email_verified_at: new Date(), status: 'PENDING' }

7. Return 201: { message: "Registration submitted. Pending administrative verification." }
```

---

### Stage 3 — Admin Approval

**Admin views requests:** `GET /api/admin/staff-requests`  
**Admin approves:** `POST /api/admin/staff-requests/[id]/approve`

Full approval logic:

```
1. Fetch staffRegistrationRequests by id (404 if not found)
2. Validate status === 'PENDING' (409 if already approved/rejected)

3. Determine target role string from request.requested_role:
   'FACULTY'           → roleToAssign = 'faculty'
   'ADMISSION_CLERK'   → roleToAssign = 'admission_clerk'
   'SCHOLARSHIP_CLERK' → roleToAssign = 'scholarship_clerk'

4. Determine staff_category:
   'FACULTY' → 'FACULTY'
   otherwise → 'NON_TEACHING'

5. Generate employee_id:
   Auto-incremented institutional format (e.g., KU2026001)

6. db.transaction():
   a. INSERT INTO staffAccounts:
      { name, email, employee_id, staff_category, designation,
        mobile_hash, account_status: 'PENDING_ACTIVATION' }
      → newStaffId = result.insertId

   b. Resolve role_id from staffRoles:
      SELECT id FROM staff_roles WHERE role_code = targetRole
      If not found → INSERT (upsert)

   c. INSERT INTO staffAccountRoles:
      { staff_account_id: newStaffId, role_id, assigned_by: adminId }

   d. IF FACULTY: Parse academic_affiliations JSON:
      For each { department_code, program_codes }:
        Resolve department_id from academicDepartments
        For each program_code:
          Resolve program_id from academicPrograms
          INSERT INTO staffAcademicAffiliations:
          { staff_account_id: newStaffId, department_id, program_id, is_hod: false }

   e. Generate activation token:
      rawToken = crypto.randomBytes(32).toString('hex')
      token_hash = crypto.createHash('sha256').update(rawToken).digest('hex')
      expires_at = new Date(Date.now() + 48 * 60 * 60 * 1000)  // 48 hours
      INSERT INTO staffAccountActivationTokens:
      { staff_account_id: newStaffId, token_hash, expires_at }

   f. UPDATE staffRegistrationRequests SET status='APPROVED'
   
   g. INSERT INTO audit_logs (action, performed_by: adminId, ip)

7. After transaction: Build activation link:
   activationLink = `${NEXT_PUBLIC_BASE_URL}/register/staff/activate?token=${rawToken}`

8. Send activation email:
   Subject: "KUCET Staff Account Activation"
   Body: Name, Employee ID, Role, 48hr activation link button
   If email fails → log error but do NOT rollback (account was created)

9. Return: { success: true, message: "Approved and activation email sent" }
```

**Admin rejects:** `POST /api/admin/staff-requests/[id]/reject`
```
UPDATE staffRegistrationRequests SET status='REJECTED', admin_notes=<notes>
```

**Resend activation:** `POST /api/admin/staff-requests/[id]/resend-activation`
```
1. Verify request is APPROVED and staffAccount exists
2. Generate new rawToken + hash
3. Insert new row in staffAccountActivationTokens
   (old tokens are left in DB but will fail expiry or uniqueness check)
4. Resend email with new link
```

---

### Stage 4 — Account Activation (Token Validation + Password Setup)

**Validate token:** `GET /api/public/staff-registration/activate?token=<rawToken>`

```
1. SHA-256 hash the incoming rawToken
2. SELECT FROM staffAccountActivationTokens WHERE token_hash = hash
   → 404 if not found
3. Check: expires_at > NOW()  → 400 "Token has expired"
4. Check: used_at IS NULL     → 400 "Token already used"
5. Fetch staffAccounts by staff_account_id
   → 404 if account not found
6. Check: account_status === 'PENDING_ACTIVATION'  → 400 if already active
7. Return: { success: true, name: staff.name, email: staff.email }
```

**Set password:** `POST /api/public/staff-registration/activate`

```
Request: { token: "<rawToken>", password: "<newPassword>", confirmPassword }

Validation:
  - password.length >= 8
  - password === confirmPassword

Server actions:
  1. Re-validate token (same as GET above — full re-check)
  2. bcrypt.hash(password, 10) → passwordHash
  3. db.transaction():
     a. UPDATE staffAccounts SET password_hash, account_status='ACTIVE'
        WHERE id = staff_account_id
     b. UPDATE staffAccountActivationTokens SET used_at=NOW()
        WHERE token_hash = hash
  4. Return: { success: true, message: "Account activated. You can now log in." }
```

The `PasswordSetupClient.js` (167 lines) includes:
- Real-time password strength indicator (weak/medium/strong based on length + special chars)
- Confirm password live validation
- Loading states during submission
- Auto-redirect to staff login on success

---

## 6. New API Endpoints — Complete Reference

### 6.1 Public Endpoints (No Authentication)

| Method | Path | Purpose | Auth |
|---|---|---|---|
| `POST` | `/api/public/staff-registration` | Submit registration request | None |
| `POST` | `/api/public/staff-registration/email/send-otp` | Send OTP to email | None |
| `POST` | `/api/public/staff-registration/email/verify-otp` | Verify OTP → return JWT token | None |
| `GET` | `/api/public/staff-registration/activate` | Validate activation token | None |
| `POST` | `/api/public/staff-registration/activate` | Set password + activate account | None |

### 6.2 Admin Endpoints (Requires `admin` auth)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/staff-requests` | List all registration requests |
| `POST` | `/api/admin/staff-requests/[id]/approve` | Approve → create account → send email |
| `POST` | `/api/admin/staff-requests/[id]/reject` | Reject with optional notes |
| `POST` | `/api/admin/staff-requests/[id]/resend-activation` | Regenerate token + resend email |

### 6.3 New Staff Endpoints (Requires `staff` auth)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/staff/me` | Fetch authenticated staff profile |
| `POST` | `/api/staff/send-update-email-otp` | OTP to verify new email before change |
| `POST` | `/api/staff/verify-update-email-otp` | Verify OTP, update email in profile |

### 6.4 Renamed Staff Endpoints (All `/api/clerk/*` → `/api/staff/*`)

Every existing clerk route was renamed. Full list (≈50 routes):

```
/api/clerk/login                             → /api/staff/login
/api/clerk/logout                            → /api/staff/logout
/api/clerk/personal-details                  → /api/staff/personal-details
/api/clerk/update-profile                    → /api/staff/update-profile
/api/clerk/semesters                         → /api/staff/semesters
/api/clerk/student-history                   → /api/staff/student-history
/api/clerk/students/[rollno]                 → /api/staff/students/[rollno]
/api/clerk/students/route                    → /api/staff/students/route
/api/clerk/students/search                   → /api/staff/students/search
/api/clerk/requests                          → /api/staff/requests
/api/clerk/requests/[request_id]             → /api/staff/requests/[request_id]
/api/clerk/admission/bulk-import             → /api/staff/admission/bulk-import
/api/clerk/admission/drafts                  → /api/staff/admission/drafts
/api/clerk/admission/finalize                → /api/staff/admission/finalize
/api/clerk/admission/student-requests        → /api/staff/admission/student-requests
/api/clerk/faculty/attendance                → /api/staff/faculty/attendance
/api/clerk/faculty/assignments               → /api/staff/faculty/assignments
/api/clerk/faculty/interests                 → /api/staff/faculty/interests
/api/clerk/faculty/materials                 → /api/staff/faculty/materials
/api/clerk/faculty/marks                     → /api/staff/faculty/marks
/api/clerk/hod/branch-config                 → /api/staff/hod/branch-config
/api/clerk/hod/branch-subjects               → /api/staff/hod/branch-subjects
/api/clerk/hod/faculty-load                  → /api/staff/hod/faculty-load
/api/clerk/hod/subject-assignments           → /api/staff/hod/subject-assignments
/api/clerk/hod/substitutions                 → /api/staff/hod/substitutions
/api/clerk/hod/syllabus                      → /api/staff/hod/syllabus
/api/clerk/hod/timetable                     → /api/staff/hod/timetable
/api/clerk/scholarship/application/[id]      → /api/staff/scholarship/application/[id]
/api/clerk/scholarship/metrics               → /api/staff/scholarship/metrics
/api/clerk/scholarship/payments              → /api/staff/scholarship/payments
/api/clerk/scholarship/payments/[id]         → /api/staff/scholarship/payments/[id]
/api/clerk/scholarship/sanctions             → /api/staff/scholarship/sanctions
/api/clerk/scholarship/sanctions/[id]        → /api/staff/scholarship/sanctions/[id]
/api/clerk/scholarship/search-by-name        → /api/staff/scholarship/search-by-name
/api/clerk/scholarship/summary/[rollno]      → /api/staff/scholarship/summary/[rollno]
/api/clerk/scholarship/window                → /api/staff/scholarship/window
/api/clerk/certificates                      → /api/staff/certificates
```

---

## 7. Global `clerk` → `staff` Rename — Every Layer

Commit `a8b68155` — **212 files changed**.

### 7.1 URL Routes (Pages)

| Before | After |
|---|---|
| `src/app/clerk/` (entire dir) | `src/app/staff/` |
| `/clerk/admission/dashboard` | `/staff/admission/dashboard` |
| `/clerk/faculty/dashboard` | `/staff/faculty/dashboard` |
| `/clerk/faculty/attendance` | `/staff/faculty/attendance` |
| `/clerk/scholarship/dashboard` | `/staff/scholarship/dashboard` |
| `/clerk/hod/dashboard` | `/staff/hod/dashboard` |
| `/clerk/settings/edit-profile` | `/staff/settings/edit-profile` |
| `/clerk/settings/security` | `/staff/settings/security` |
| `/clerk/academic-calendar` | `/staff/academic-calendar` |
| `/register/staff` (old page) | `/staff-registration` (new multi-step wizard) |

### 7.2 API Routes

```
src/app/api/clerk/  →  src/app/api/staff/
```
(All ~50 route files renamed, detailed in Section 6.4)

### 7.3 React Components Directory

```
src/components/clerk/  →  src/components/staff/
```

All 40 component files renamed (100% of them were pure renames — no content changes beyond import path fixes).

### 7.4 React Context

```javascript
// BEFORE
src/context/ClerkContext.js
export const ClerkContext = createContext();
export function ClerkProvider({ children }) { ... }
export function useClerk() { return useContext(ClerkContext); }

// AFTER
src/context/StaffContext.js
export const StaffContext = createContext();
export function StaffProvider({ children }) { ... }
export function useStaff() { return useContext(StaffContext); }
```

All internal `fetch()` calls updated:
- `/api/clerk/me` → `/api/staff/me`
- `/api/clerk/faculty/*` → `/api/staff/faculty/*`
- `/api/clerk/hod/*` → `/api/staff/hod/*`
- `/api/clerk/admission/*` → `/api/staff/admission/*`
- `/api/clerk/scholarship/*` → `/api/staff/scholarship/*`
- `/api/clerk/student-history` → `/api/staff/student-history`
- `/api/clerk/requests` → `/api/staff/requests`

### 7.5 Navigation Menu (`src/lib/menu-config.js`)

All 25+ navigation routes updated:

```javascript
// BEFORE (sample)
clerk: [
  { label: 'DASHBOARD',  route: '/clerk/admission/dashboard' },
  { label: 'PROFILE',    route: '/clerk/admission/profile' },
  { label: 'SETTINGS',   children: [
    { label: 'Edit Profile',       route: '/clerk/settings/edit-profile' },
    { label: 'Security & Privacy', route: '/clerk/settings/security' }
  ]},
],
faculty: [
  { label: 'DASHBOARD',  route: '/clerk/faculty/dashboard' },
  { label: 'ATTENDANCE', route: '/clerk/faculty/attendance' },
  // ...
]

// AFTER
clerk: [
  { label: 'DASHBOARD',  route: '/staff/admission/dashboard' },
  // ...
],
faculty: [
  { label: 'DASHBOARD',  route: '/staff/faculty/dashboard' },
  { label: 'ATTENDANCE', route: '/staff/faculty/attendance' },
  // ...
]
```

---

## 8. Authentication Layer — Full Changes

### 8.1 Cookie Names Renamed

**File:** `src/lib/auth-utils.js`

| Before | After |
|---|---|
| `clerk_auth` | `staff_auth` |
| `clerk_logged_in` | `staff_logged_in` |
| `clerk_role` | `staff_role` |
| `clerk_session_id` | `staff_session_id` |
| `clerk_refresh_token` | `staff_refresh_token` |

### 8.2 Auth Function Renamed + Updated

```javascript
// BEFORE
export async function issueClerkAuthCookie(response, clerk, rememberMe, ip, userAgent) {
  // JWT payload used: { id, clerkId, email, role, is_hod, branch }
  // Refresh token user_id = clerk.email (string)
  await issueRefreshToken(response, clerk.email, 'clerk', ...);
}

// AFTER
export async function issueStaffAuthCookie(response, staff, rememberMe, ip, userAgent) {
  // JWT payload used: { id, staffId, email, role, is_hod, branch }
  // Refresh token user_id = staff.id (integer)
  await issueRefreshToken(response, staff.id, 'staff', ...);
}
```

**JWT payload change:** `clerkId` field → `staffId` field (same value, different key name).

### 8.3 Refresh Token user_id Type Change (Critical)

| User Type | Before | After |
|---|---|---|
| Staff | `user_id = clerk.email` (string) | `user_id = staff.id` (integer) |
| Admin | `user_id = admin.email` (string) | `user_id = admin.id` (integer) |

This is a **breaking change** for any existing refresh tokens in `refresh_tokens` table. Old tokens with email as `user_id` will fail during refresh.

### 8.4 Token Refresh — Staff Path Rewritten

The `refreshAccessToken()` function for `userType === 'staff'` now performs a **multi-table JOIN** to reconstruct role/branch/HOD before re-issuing the cookie:

```javascript
} else if (userType === 'staff') {
  // 1. Find staff account by INTEGER id (not email)
  const user = await db.query.staffAccounts.findFirst({
    where: eq(staffAccounts.id, parseInt(tokenRecord.user_id))
  });
  if (!user || user.account_status !== 'ACTIVE') return null;

  // 2. Resolve role_code via JOIN
  const roleRecords = await db.select({ role_code: staffRoles.role_code })
    .from(staffAccountRoles)
    .innerJoin(staffRoles, eq(staffAccountRoles.role_id, staffRoles.id))
    .where(eq(staffAccountRoles.staff_account_id, user.id))
    .limit(1);

  let resolvedRole = 'faculty';  // default
  if (roleRecords.length > 0) {
    const rCode = roleRecords[0].role_code;
    if (rCode === 'ADMISSION_CLERK')   resolvedRole = 'admission';
    else if (rCode === 'SCHOLARSHIP_CLERK') resolvedRole = 'scholarship';
    // FACULTY → 'faculty'
  }

  // 3. Resolve branch + HOD status via JOIN (faculty only)
  let isHod = false, branch = null;
  if (resolvedRole === 'faculty') {
    const affil = await db.select({
      branch_code: academicDepartments.department_code,
      is_hod: staffAcademicAffiliations.is_hod
    })
    .from(staffAcademicAffiliations)
    .innerJoin(academicDepartments, eq(staffAcademicAffiliations.department_id, academicDepartments.id))
    .where(eq(staffAcademicAffiliations.staff_account_id, user.id))
    .limit(1);

    if (affil.length > 0) {
      branch = affil[0].branch_code;
      isHod  = affil[0].is_hod;
    }
  }

  // 4. Re-issue staff auth cookie with resolved data
  const adaptedStaff = { id: user.id, email: user.email, role: resolvedRole, is_hod: isHod, branch };
  await issueStaffAuthCookie(response, adaptedStaff, true, ip, userAgent);
  return adaptedStaff;
}
```

### 8.5 `src/proxy.js` — Cookie Name Update

```javascript
// BEFORE
const clerkAuth = cookies.get('clerk_auth');
let clerkRes = clerkAuth ? await verify(clerkAuth.value, jwtSecret) : { payload: null, expired: false };

// AFTER
const staffAuth = cookies.get('staff_auth');
let staffRes = staffAuth ? await verify(staffAuth.value, jwtSecret) : { payload: null, expired: false };
```

### 8.6 `src/lib/api-utils.js` — Role Alias Added

```javascript
// getAuthUser() — staff routes accept both 'clerk' and 'staff' role identifiers
// for backwards compatibility during transition
} else if (expectedRole === 'clerk' || expectedRole === 'staff') {
  if (!isClerk) return null;
}
```

### 8.7 `src/lib/asset-auth.js` — `isUserActive()` Updated

```javascript
// BEFORE: checked clerks table with is_active boolean
const clerkRecord = await db.query.clerks.findFirst({
  where: clerkId ? eq(clerks.id, clerkId) : eq(clerks.email, user.email),
  columns: { id: true, is_active: true }
});
return clerkRecord.is_active !== false && clerkRecord.is_active !== 0;

// AFTER: checks staffAccounts with account_status enum
const staffRecord = await db.query.staffAccounts.findFirst({
  where: staffId ? eq(staffAccounts.id, staffId) : eq(staffAccounts.email, user.email),
  columns: { id: true, account_status: true }
});
return staffRecord.account_status === 'ACTIVE';
```

### 8.8 `src/lib/logout.js` — Endpoint + Cookie Names

```javascript
// BEFORE
await logoutAndRedirect({ endpoint: '/api/clerk/logout', redirect });
// ...
cookies: ['clerk_auth', 'clerk_logged_in'],
sessionStorageKeys: ['clerk_authenticated'],

// AFTER
await logoutAndRedirect({ endpoint: '/api/staff/logout', redirect });
// ...
cookies: ['staff_auth', 'staff_logged_in'],
sessionStorageKeys: ['staff_authenticated'],
```

---

## 9. New UI Pages & Components

### 9.1 `/staff-registration` — Multi-Step Registration Wizard (746 lines)

**File:** `src/app/staff-registration/page.js`

Replaces the old simple `/register/staff` page. Full client-side multi-step form:

```
Step 1: Email Verification
  ├── Enter institutional email address
  ├── Click "Send OTP" → POST /api/public/staff-registration/email/send-otp
  ├── 6-digit OTP input with 10-min countdown timer
  └── "Verify OTP" → POST /api/public/staff-registration/email/verify-otp
       Returns: verificationToken (stored in state)

Step 2: Personal Information
  ├── Full Name
  ├── Mobile Number (10 digits, validated)
  └── Designation (free text)

Step 3: Role Selection
  ├── Faculty (Teaching Staff)
  ├── Admission Clerk (Student Admissions)
  └── Scholarship Clerk (Financial Aid)

Step 4: Academic Affiliation (Faculty only)
  ├── Department dropdown (fetched from /api/public/departments)
  ├── Program/Course checkboxes (fetched based on dept selection)
  └── Multiple programs can be selected

Step 5: Review & Submit
  ├── Summary of all entered information
  ├── "Submit Registration" → POST /api/public/staff-registration
  └── Success message with next steps (await admin approval)
```

### 9.2 `/register/staff/activate` — Account Activation Page

**Files:**
- `src/app/register/staff/activate/page.js` (132 lines) — server page
- `src/app/register/staff/activate/PasswordSetupClient.js` (167 lines) — client component

**Flow:**
```
1. Page loads with ?token=<rawToken> from URL
2. Immediate GET /api/public/staff-registration/activate?token=<rawToken>
   → Shows: staff name, email
   → Error states: expired / invalid / already used

3. PasswordSetupClient renders:
   ├── Password field (min 8 chars)
   ├── Real-time strength indicator:
   │     < 8 chars    → "Too Short" (red)
   │     8+ chars     → "Weak" (orange)
   │     + upper/lower → "Medium" (yellow)
   │     + numbers/symbols → "Strong" (green)
   ├── Confirm password field (live match validation)
   └── "Activate Account" button

4. POST /api/public/staff-registration/activate
   { token, password, confirmPassword }
   → account_status = 'ACTIVE'
   → Redirect to staff login
```

### 9.3 `/staff/settings/security` — Security Settings Page (New)

**File:** `src/app/staff/settings/security/page.js` (202 lines)

Previously existed as `src/app/clerk/settings/security/page.js` but was **deleted** (not renamed) and replaced with a new version that uses `StaffContext` and the new email update OTP endpoints:

- Change password section (requires current password)
- Change email section:
  1. Enter new email
  2. Send OTP to new email (`/api/staff/send-update-email-otp`)
  3. Verify OTP (`/api/staff/verify-update-email-otp`)
  4. Email updated in `staffAccounts` table

---

## 10. Services Layer — Detailed Changes

### 10.1 `ClerkRegistrationService.js` — Approval Flow Rewritten

**File:** `src/services/identity/ClerkRegistrationService.js`

The approval method now targets `staffAccounts` instead of `clerks` and performs the full 4-table insert chain:

```javascript
// OLD: Simple insert into clerks
await db.insert(clerks).values({
  name, email, employee_id, password_hash,
  role: targetRole, branch: targetBranch,
  is_hod: false, is_active: true, must_change_password: true
});

// NEW: Insert into staffAccounts + roles + affiliations
// 1. Upsert role into staffRoles
let roleId = await getOrCreateRole(targetRole);

// 2. Create staffAccounts record
const [result] = await db.insert(staffAccounts).values({
  name, email, employee_id, password_hash: passwordHash,
  staff_category: categoryKey, designation: catInfo.label,
  mobile_hash, pfp, signature, account_status: 'PENDING_ACTIVATION'
});
const newStaffId = result.insertId;

// 3. Link role
await db.insert(staffAccountRoles).values({
  staff_account_id: newStaffId, role_id
});

// 4. Link department (faculty only)
if (targetBranch) {
  const deptId = await getOrCreateDepartment(targetBranch);
  await db.insert(staffAcademicAffiliations).values({
    staff_account_id: newStaffId, department_id: deptId, is_hod: false
  });
}
```

**First-login password change updated:**
```javascript
// OLD: updated must_change_password flag
await db.update(clerks).set({
  password_hash: newHash,
  must_change_password: false,
  password_changed_at: new Date()
}).where(eq(clerks.id, clerkId));

// NEW: activates account
await db.update(staffAccounts).set({
  password_hash: newHash,
  account_status: 'ACTIVE'
}).where(eq(staffAccounts.id, clerkId));
```

### 10.2 `FacultyService.js` — Multi-Table JOINs Replace Simple Queries

```javascript
// OLD: Simple query on clerks table
db.select({ id: clerks.id, name: clerks.name, home_branch: clerks.branch })
  .from(clerks)
  .where(eq(clerks.role, 'faculty'))

// NEW: 4-table JOIN
db.select({
  id: staffAccounts.id,
  name: staffAccounts.name,
  home_branch: academicDepartments.department_code
})
.from(staffAccounts)
.innerJoin(staffAccountRoles, eq(staffAccountRoles.staff_account_id, staffAccounts.id))
.innerJoin(staffRoles, eq(staffAccountRoles.role_id, staffRoles.id))
.leftJoin(staffAcademicAffiliations, eq(staffAcademicAffiliations.staff_account_id, staffAccounts.id))
.leftJoin(academicDepartments, eq(staffAcademicAffiliations.department_id, academicDepartments.id))
.where(eq(staffRoles.role_code, 'FACULTY'))
```

**Timetable faculty name display updated:**
```javascript
// OLD
sql`COALESCE(CASE WHEN ${clerks.is_active} = false
    THEN CONCAT('[Unassigned - Formerly ', ${clerks.name}, ']')
    ELSE ${clerks.name} END, '[Unassigned]')`

// NEW
sql`COALESCE(CASE WHEN ${staffAccounts.account_status} != 'ACTIVE'
    THEN CONCAT('[Unassigned - Formerly ', ${staffAccounts.name}, ']')
    ELSE ${staffAccounts.name} END, '[Unassigned]')`
```

### 10.3 `SecurityService.js`

```javascript
// Role type check updated
// OLD: ['CLERK', 'FACULTY', 'HOD'].includes(userType.toUpperCase())
// NEW: userType.toUpperCase() === 'STAFF'

// Table queries updated: clerks → staffAccounts
// account check: is_active → account_status === 'ACTIVE'

// Session registration: now throws on failure (was silently swallowing errors)
throw new Error('Failed to register user session');
```

### 10.4 `ValidationService.js` — Branch Staff Count Query

```javascript
// OLD: Simple clerks.branch column query
const clerkRows = await db.select({ count: sql`count(*)` })
  .from(clerks).where(eq(clerks.branch, branchName));

// NEW: 3-table JOIN through affiliations
const staffRows = await db.select({ count: sql`count(*)` })
  .from(staffAccounts)
  .innerJoin(staffAcademicAffiliations,
    eq(staffAccounts.id, staffAcademicAffiliations.staff_account_id))
  .innerJoin(academicDepartments,
    eq(staffAcademicAffiliations.department_id, academicDepartments.id))
  .where(eq(academicDepartments.department_code, branchName));
```

### 10.5 `OrphanMediaService.js`

```javascript
// OLD: scanned clerks.pfp and clerks.signature
// NEW: scans staffAccounts.pfp and staffAccounts.signature
```

### 10.6 `FinanceService.js`

Staff-linked financial queries updated from `clerks.id` → `staffAccounts.id` joins.

---

## 11. Middleware, Proxy & Route Protection

### `src/proxy.js` (Simplified summary)

```javascript
// Cookie detection renamed
const staffAuth = cookies.get('staff_auth');   // was clerk_auth
let staffRes = staffAuth ? await verify(staffAuth.value, jwtSecret) : { payload: null, expired: false };

// Route protection logic
// /staff/* routes → require valid staff_auth cookie
// All protection logic unchanged, just cookie name references updated
```

### `src/lib/path-utils.js`

- `isClerkRoute(path)` — updated to match `/staff/*` paths
- Role-based redirect helpers updated from `/clerk/*` to `/staff/*`
- Login redirect for staff role: `/staff/redirects`

---

## 12. Admin Console Changes

### `src/app/admin/staff-requests/page.js` — New Admin Section (494→696 lines)

Complete new page for managing staff registration requests:

**Features:**
- Tabbed view: PENDING / APPROVED / REJECTED
- Each request card shows: name, email, requested_role, designation, academic_affiliations, submitted_at
- **Approve button**: triggers POST to approve API → shows activation email sent confirmation
- **Reject button**: opens modal for admin notes → triggers reject API
- **Resend Activation button**: visible for APPROVED accounts that haven't activated yet
- Real-time status updates (optimistic UI)

### `src/app/admin/manage-clerks/page.js` — Refactored (696 lines)

Updated to query `staffAccounts` table for new staff while maintaining the existing `clerks` table display for legacy accounts. Both account types shown in the same UI with visual differentiation.

### `src/app/admin/layout.js`

Minor update: Staff-Requests nav link added to admin sidebar.

### `src/components/LoginPanel.js` — 179 Lines Removed

The embedded staff registration link and mini-wizard that was cluttering the login panel was removed. Users are now directed to the standalone `/staff-registration` page via a clean "Register as Staff" link only.

---

## 13. Core Library Changes

### `src/hooks/security/useEmailVerification.js` (+36 lines)

New OTP-based email update flow added for staff settings page:

```javascript
// New functions added
async function sendEmailUpdateOtp(newEmail) {
  await fetch('/api/staff/send-update-email-otp', { method: 'POST', body: { newEmail } });
}

async function verifyEmailUpdateOtp(newEmail, otp) {
  await fetch('/api/staff/verify-update-email-otp', { method: 'POST', body: { newEmail, otp } });
}
```

### `src/hooks/security/usePasswordManagement.js`

Password change endpoint updated from `/api/clerk/settings/password` → `/api/staff/settings/password`.

### `src/context/FacultyAttendanceContext.js`

- `useClerk()` → `useStaff()` import
- All internal staff data fetches via updated `StaffContext`

### `src/components/Sidebar.js`

All 20 navigation link `href` values updated from `/clerk/*` → `/staff/*`.

### `src/components/Navbar.js`

Staff authentication state detection reads `staff_logged_in` cookie (was `clerk_logged_in`).

### `src/components/HomeLoginLanding.client.js`

Registration CTA updated to link to `/staff-registration` instead of the old `/register/staff`.

### `src/components/RealtimeListener.js`

Staff role channel subscription updated from `clerk` → `staff` user type.

---

## 14. Build & Deployment — Memory Optimizations

**File:** `next.config.mjs` — Commit `08b10a4c`

Added to fix **Render/cloud OOM (Out of Memory) build failures**:

```javascript
const nextConfig = {
  output: 'standalone',
  reactCompiler: true,

  // NEW: Fix OOM during builds on Render/Hostinger
  productionBrowserSourceMaps: false,        // Disable source map generation
  eslint: { ignoreDuringBuilds: true },       // Skip ESLint during build
  typescript: { ignoreBuildErrors: true },    // Skip TypeScript errors during build
  experimental: { webpackBuildWorker: true }, // Separate webpack worker process

  // ... (rest unchanged)
};

// NEW: Sentry config - disable sourcemap upload during builds
export default withSentryConfig(withPWA(nextConfig), {
  sourcemaps: {
    disable: true,   // Prevents Sentry from uploading sourcemaps (causes 8GB memory leak)
  },
  // ...
});
```

**Why this matters:** Previous builds on Render were OOMing at ~8GB during Sentry sourcemap upload. These settings reduce peak build memory by ~60%.

---

## 15. Test Suite Changes

### 15.1 New Test Files

| File | Tests | Coverage |
|---|---|---|
| `tests/unit/services/FacultyService.test.js` | +25 tests | Staff academic affiliation queries, HOD resolution, department/program JOINs, timetable faculty name COALESCE |

### 15.2 Modified Unit Tests

| File | Change |
|---|---|
| `tests/unit/api/auth/admin-login.test.js` | Mock updated: admin refresh token now uses integer ID |
| `tests/unit/api/auth/refresh.test.js` | Updated for `staff` userType, integer ID in `user_id` field |
| `tests/unit/api/bulk-import-fallback.test.js` | Import path fix (`/api/staff/admission/bulk-import`) |
| `tests/unit/lib/email.test.js` | New staff activation email template assertions |
| `tests/unit/services/SecurityService.test.js` | Updated for `STAFF` user type, `staffAccounts` table |
| `tests/unit/storage-architecture.test.js` | Minor path update |

### 15.3 Modified E2E Tests

| File | Change |
|---|---|
| `tests/attendance-routing.spec.js` | All `/clerk/` → `/staff/` route assertions (68 lines updated) |
| `tests/attendance.spec.js` | Cookie assertions: `clerk_logged_in` → `staff_logged_in` |
| `tests/student-fee-payment.spec.js` | Cookie assertions: `clerk_auth` → `staff_auth` |

---

## 16. Files Deleted

| File | Reason |
|---|---|
| `src/app/clerk/` (entire directory) | Renamed to `src/app/staff/` |
| `src/app/api/clerk/` (entire directory) | Renamed to `src/app/api/staff/` |
| `src/components/clerk/` (entire directory) | Renamed to `src/components/staff/` |
| `src/context/ClerkContext.js` | Renamed to `StaffContext.js` |
| `src/app/clerk/settings/security/page.js` | Replaced by new `src/app/staff/settings/security/page.js` |
| `src/app/register/staff/page.js` | Replaced by new `src/app/staff-registration/page.js` |
| `test_cloudinary.js` | Debug scratch file removed from repo root |

---

## 17. Full File Manifest

### Created (≈20 new source files)

```
src/app/staff-registration/page.js                              746 lines
src/app/register/staff/activate/page.js                         132 lines
src/app/register/staff/activate/PasswordSetupClient.js          167 lines
src/app/staff/settings/security/page.js                         202 lines
src/app/api/staff/me/route.js                                   new
src/app/api/staff/send-update-email-otp/route.js               112 lines
src/app/api/staff/verify-update-email-otp/route.js             104 lines
src/app/api/public/staff-registration/route.js                  131 lines
src/app/api/public/staff-registration/email/send-otp/route.js   50 lines
src/app/api/public/staff-registration/email/verify-otp/route.js 52 lines
src/app/api/public/staff-registration/activate/route.js         91 lines
src/app/admin/staff-requests/page.js                            494 lines
src/app/api/admin/staff-requests/route.js                        16 lines
src/app/api/admin/staff-requests/[id]/approve/route.js          211 lines
src/app/api/admin/staff-requests/[id]/reject/route.js            62 lines
src/app/api/admin/staff-requests/[id]/resend-activation/route.js 98 lines
tests/unit/services/FacultyService.test.js                       25 tests
```

### Renamed (~180 files — `clerk` → `staff`)

```
src/app/clerk/**                     →  src/app/staff/**          (25 pages)
src/app/api/clerk/**                 →  src/app/api/staff/**      (50 routes)
src/components/clerk/**              →  src/components/staff/**   (40 components)
src/context/ClerkContext.js          →  src/context/StaffContext.js
```

### Significantly Modified (~15 files)

```
src/lib/auth-utils.js              Cookie rename + refresh token logic rewrite
src/proxy.js                       staff_auth cookie
src/lib/menu-config.js             All nav links /clerk/* → /staff/*
src/lib/path-utils.js              Path matching + redirect updates
src/lib/api-utils.js               Role alias: 'clerk' || 'staff'
src/lib/asset-auth.js              staffAccounts.account_status check
src/lib/logout.js                  /api/staff/logout + staff_* cookies
src/lib/email.js                   Staff activation email template
src/context/StaffContext.js        Full renamed context with all /api/staff/* fetches
src/db/schema/identity.js          5 new/modified table exports + json import
src/db/schema/academic.js          2 new tables (academicDepartments, academicPrograms)
src/services/identity/ClerkRegistrationService.js  Approval flow rewrite
src/services/academic/FacultyService.js            4-table JOIN queries
src/services/security/SecurityService.js           STAFF type + staffAccounts
src/services/security/ValidationService.js         Branch staff count via JOIN
src/app/admin/manage-clerks/page.js               staffAccounts integration
next.config.mjs                    Memory optimizations (OOM fix)
```

### Deleted

```
src/app/clerk/                     (entire directory ~25 files)
src/app/api/clerk/                 (entire directory ~50 files)
src/components/clerk/              (entire directory ~40 files)
src/context/ClerkContext.js
src/app/clerk/settings/security/page.js
src/app/register/staff/page.js
test_cloudinary.js
```

---

## 18. Deployment Checklist

### ⚠️ BEFORE DEPLOYING

**Database (Mandatory)**
- [ ] Run `npm run db:generate` — review generated SQL for all 7 new tables
- [ ] Audit the RENAME: `clerk_registration_requests` → `staff_registration_requests`
- [ ] Audit the DROP columns: `branch`, `department`, `mobile` from requests table
- [ ] Run `npm run db:migrate`
- [ ] Run seed SQL: `staff_roles` (3 rows), `academic_departments`, `academic_programs`

**Dependencies**
- [ ] Run `npm install` (no new packages in Session 207 — already done in Session 206)

**Environment Variables**
- [ ] `NEXT_PUBLIC_BASE_URL` must be set (used in activation email link generation)
- [ ] `JWT_SECRET` must be set (used to sign email verification tokens)
- [ ] Email service (`BREVO_API_KEY`, `EMAIL_USER`) must be configured for activation emails

### ⚠️ ON DEPLOY

**Session Invalidation**
- [ ] Alert all staff users: **they must log in again** — all `clerk_auth` cookies are invalid
- [ ] All existing refresh tokens with email as `user_id` will fail — staff must re-login manually
- [ ] Consider setting a maintenance window for staff login

**Existing `clerks` Table**
- [ ] The old `clerks` table is **NOT dropped** — existing staff accounts remain functional
- [ ] New registrations go to `staffAccounts`; existing clerks still log in via the `clerks` path
- [ ] Plan migration of existing `clerks` records to `staffAccounts` in a future session

### ✅ AFTER DEPLOYING

- [ ] Verify `/staff-registration` page loads and OTP email sends
- [ ] Verify Admin can see `/admin/staff-requests`
- [ ] Test full flow: register → admin approve → activate link → login
- [ ] Verify existing staff (in `clerks` table) can still log in
- [ ] Run `npm run test` — all tests should pass
- [ ] Run E2E: `npx playwright test` — attendance and fee payment flows should pass

---

## Cross-References

- [GEMINI.md](../../GEMINI.md) — Updated with Session 207 commits and new directory map
- [Authentication Architecture](../authentication/authentication.md) — Cookie engine, JWT claims
- [Backend Architecture](../architecture/backend.md) — Service layer, API patterns
- [Database Schema](../database/schema.md) — Full schema reference
- [Migration History](./migration-history.md) — Session 207 migration entry
- [Session 206 Release Notes](./session-206-release-notes.md) — Previous release

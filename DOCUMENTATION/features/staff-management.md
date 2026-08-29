# Institutional Staff Hierarchy & Management Architecture

**System Version:** Session 208 (latest)
**Last Updated:** August 25, 2026
**Status:** Active Development / Pre-Merge  

---

## 1. Executive Staff Hierarchy & Design Principles

The KUCET College Management System enforces a strict 3-category staff self-registration workflow and explicit role hierarchy.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SUPER ADMIN CONSOLE                              │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
  🎓 FACULTY                   💰 SCHOLARSHIP CLERK          📝 ADMISSION CLERK
  (Academic Branch Assigned)   (Financial / Sanction Ledgers)(Student Admissions)
         │
         │ (Promoted by Admin Only via faculty_hod_assignments)
         ▼
  👑 HEAD OF DEPARTMENT (HOD)
  (Branch Privilege, Timetables, Workload & Condonation)
```

---

## 2. Staff Categories & Registration Workflow

### Authorized Self-Registration Categories:
1. **Faculty (`FACULTY`)**: Teaching faculty members. Must select **Academic Affiliations** (Department: `CSE`, `CSD`, `ECE`, `EEE`, `MECH`, `CIVIL`, `IT` and associated programs).
2. **Scholarship Staff (`SCHOLARSHIP_STAFF`)**: Administrative staff managing scholarship sanctions, fee receipts, and financial ledgers.
3. **Admission Staff (`ADMISSION_STAFF`)**: Administrative staff managing student admissions, roll number generation, and registration drafts.

### Unallowed Self-Registration Options:
- **Head of Department (HOD)**: HOD is **NOT** a self-registration option. HOD status is a privilege granted exclusively by Super Admin to an active Faculty member.
- Generic office or department options (Exam Cell, Academic Section, etc.) are deprecated.

---

## 3. Head of Department (HOD) Promotion & Demotion Workflow

1. **Self-Registration**: Faculty applicant registers via `/staff-registration` with `staff_category: FACULTY` and selects department/programs.
2. **Admin Approval**: Super Admin approves registration (`POST /api/admin/staff-requests/[id]/approve`). Account is created with `account_status: PENDING_ACTIVATION`.
3. **Activation**: Staff member sets password via token link (`/register/staff/activate`). Account status transitions to `ACTIVE`.
4. **HOD Promotion**: Super Admin navigates to **Staff Management -> Academic Faculty** (`/admin/manage-staff`), toggles **"Head of Department"**, and clicks **"Save Changes"**.
   - System updates `faculty_hod_assignments` (`is_active = true`, `assigned_by = 1` referencing the Super Admin `principal` table).
   - **Transaction Safety**: The toggle on the frontend is uncoupled from the immediate API call, preventing accidental submissions. It commits only upon explicit user confirmation via a modal intercept.
   - **Branch Invariant Guard**: Enforces exactly **one active HOD per department**. Attempting to assign a second active HOD throws a conflict error prompting the admin to demote the current HOD first.
   - **Academic Year Bounds**: Dynamically fetches the active academic year bounds from the `semesters` table rather than hardcoding dates.
5. **HOD Demotion**: Super Admin toggles off HOD status and saves. System sets `faculty_hod_assignments.is_active = false` preserving the historical record of the HOD assignment, reverting the account to standard Faculty status.

---

## 4. Database Schema Structure (Session 207 Modular Schemas)

### Core Staff Tables (`src/db/schema/identity.js` & `operations.js`):
- `staff_accounts`: Master account table (`id`, `name`, `email`, `employee_id`, `password_hash`, `staff_category`, `designation`, `mobile_hash`, `pfp`, `signature`, `account_status`, `address`).
- `staff_roles`: Lookup table (`id`, `role_code`, `description`).
- `staff_account_roles`: Many-to-many role mapping (`id`, `staff_account_id`, `role_id`, `assigned_by`).
- `staff_academic_affiliations`: Faculty program links (`id`, `staff_account_id`, `department_id`, `program_id`).
- `faculty_hod_assignments`: Departmental HOD assignments (`id`, `staff_account_id`, `department_code`, `academic_year`, `start_date`, `end_date`, `is_active`).
- `staff_account_activation_tokens`: 48-hour SHA-256 hashed activation tokens (`id`, `staff_account_id`, `token_hash`, `expires_at`, `used_at`).
- `staff_registration_requests`: Pending onboarding requests (`id`, `name`, `email`, `requested_role`, `academic_affiliations`, `email_verified_at`, `status`, `rejection_reason`).

---

## 5. Secure Onboarding & Activation Pipeline (4-Stage Flow)

1. **Email OTP Verification**: Applicant verifies institutional email via 6-digit OTP (`/api/public/staff-registration/email/send-otp` -> `verify-otp`), generating a signed JWT verification token.
2. **Registration Submission**: Applicant submits personal information and academic affiliations (`POST /api/public/staff-registration`).
3. **Admin Review & Approval**: Super Admin approves request (`POST /api/admin/staff-requests/[id]/approve`). Generates auto-incremented Employee ID, creates `staff_accounts` record (`PENDING_ACTIVATION`), generates SHA-256 activation token, and emails 48-hour activation link.
4. **Token Verification & Password Setup**: Applicant opens `/register/staff/activate?token=...`, validates token, sets password (`bcrypt` hashed), and activates account (`account_status = 'ACTIVE'`).

---

## 6. Centralized Configuration (`src/lib/staff-config.js`)

```javascript
export const STAFF_CATEGORIES = {
  FACULTY: { id: 'FACULTY', label: 'Faculty', role: 'faculty', requiresBranch: true },
  SCHOLARSHIP_STAFF: { id: 'SCHOLARSHIP_STAFF', label: 'Scholarship Staff', role: 'scholarship', requiresBranch: false },
  ADMISSION_STAFF: { id: 'ADMISSION_STAFF', label: 'Admission Staff', role: 'admission', requiresBranch: false },
};

export const FACULTY_BRANCHES = ['CSE', 'CSD', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT'];
```

---

## 7. HOD Staff Management Capabilities (Phase H5)

Under the `/staff/hod/staff-management` module, Head of Departments are granted specialized administrative privileges to manage faculty within their authorized department and associated programs.

### Active Faculty Management & Access Control
HODs can view all active faculty members affiliated with their department. Through the unified **"Manage"** interface, HODs can control:

1. **Faculty Portal Access**: HODs can toggle a faculty member's account status between `ACTIVE` and `DISABLED`. Disabling an account is a hard security action that automatically purges all active `user_sessions` and `refresh_tokens` for that user, instantly terminating their access.
2. **Subject Assignment Management (`faculty_subject_assignments`)**: HODs can manage granular subject access by toggling subject assignments as active or inactive. This soft-toggling preserves historical records without requiring hard deletion of records. **Assignment Branch Scoping (Phase H5.9):** HOD subject assignments and faculty requests are dynamically scoped to the user's `staff_academic_affiliations` boundaries to prevent cross-departmental overriding.
3. **Requested Subjects Approval (`faculty_subject_interests`)**: HODs can review and approve pending subject interests submitted by faculty. Approving an interest converts it directly into an active assignment, automatically computing the current academic term based on system configuration. **Faculty Subject Request Deduplication (Phase H5.8):** Faculty cannot submit duplicate requests for the same subject in the same academic year (regardless of whether the past request was pending, approved, or rejected). The UI actively disables the "Express Interest" button for already-assigned subjects.

### Transactional Integrity
To ensure system consistency, all HOD management actions execute via atomic database transactions. Modifications to account status, subject assignments, or interest approvals commit simultaneously, and all actions log comprehensive event records to the `audit_logs` table for administrative oversight.


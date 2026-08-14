# Institutional Staff Hierarchy & Management Architecture

**System Version:** Session 206 Production Release  
**Last Updated:** August 13, 2026  
**Status:** Stable / Production-Ready  

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
         │ (Promoted by Admin Only)
         ▼
  👑 HEAD OF DEPARTMENT (HOD)
  (Branch Privilege & Timetable Management)
```

---

## 2. Staff Categories & Registration Workflow

### Authorized Self-Registration Categories:
1. **Faculty (`FACULTY`)**: Teaching faculty members. Must select an **Associated Academic Branch** (`CSE`, `CSD`, `ECE`, `EEE`, `MECH`, `CIVIL`, `IT`).
2. **Scholarship Clerk (`SCHOLARSHIP_CLERK`)**: Administrative clerk managing scholarship sanctions, fee receipts, and financial ledgers.
3. **Admission Clerk (`ADMISSION_CLERK`)**: Administrative clerk managing student admissions, roll number generation, and registration drafts.

### Unallowed Self-Registration Options:
- **Head of Department (HOD)**: HOD is **NOT** a self-registration option. HOD status is a privilege granted exclusively by Super Admin to an active Faculty member.
- Generic office or department options (Exam Cell, Academic Section, etc.) have been completely removed.

### Designation Field Removal Rationale:
- **Removal Rationale**: Free-text designations created inconsistent records and data redundancy. Designation is now implicitly governed by the selected `staff_category` and institutional role mappings.

---

## 3. Head of Department (HOD) Promotion & Demotion Workflow

1. **Self-Registration**: Faculty applicant registers with `staff_category: FACULTY` and selects their academic branch (e.g. `CSE`).
2. **Admin Approval**: Super Admin approves registration. Account created with `role: faculty`, `branch: CSE`, `is_hod: false`.
3. **HOD Promotion**: Super Admin navigates to **Staff Management -> Academic Faculty** tab and clicks **"Promote HOD"**.
   - System sets `is_hod: true`.
   - **Branch Invariant Guard**: Enforces exactly **one active HOD per branch**. Attempting to assign a second HOD returns an HTTP 400 conflict with a prompt to demote the current HOD first.
4. **HOD Demotion**: Super Admin clicks **"Demote HOD"**. System sets `is_hod: false`, reverting the account to standard Faculty status without data loss.

---

## 4. Database Schema Modifications

### `clerk_registration_requests`
- `staff_category`: `varchar(50) NOT NULL DEFAULT 'FACULTY'` (`FACULTY`, `SCHOLARSHIP_CLERK`, `ADMISSION_CLERK`)
- `branch`: `varchar(50) NULL` (Required for `FACULTY`: `CSE`, `CSD`, `ECE`, `EEE`, `MECH`, `CIVIL`, `IT`)
- `designation`: `varchar(100) NULL` (Made optional/nullable following designation field deprecation)

---

## 5. Secure Onboarding & Credential Generation Workflow

To prevent static credential leakage and enforce zero-trust security:

1. **Admin Approval**: Super Admin reviews and approves a pending staff registration request (`approveRequest()`).
2. **Cryptographic Passphrase Generation**: The system generates a cryptographically random, high-entropy initial passphrase using `crypto.randomBytes(6)` formatted dynamically (`generateSecureRandomPassphrase()`). Source code contains **NO hardcoded default passwords**, static prefixes (such as `Kucet@`, `Welcome@`, or `Admin123`), or predictable constants.
3. **Bcrypt Password Hashing**: The initial passphrase is immediately hashed using `bcrypt` (`saltRounds = 10`) before database storage (`password_hash`). Raw passphrases are never stored or logged.
4. **Institutional Welcome Email**: The single-use temporary passphrase is emailed directly to the approved staff member's institutional email address.
5. **Mandatory First-Login Reset**: The account is flagged with `must_change_password = true`.
6. **First-Login Enforcement**: Upon initial login, the staff member is redirected to `/clerk/settings/security` (or password change prompt) and forced to set a new password. Once updated, `must_change_password` is set to `false`.

---

## 6. Centralized Configuration (`src/lib/staff-config.js`)

```javascript
export const STAFF_CATEGORIES = {
  FACULTY: { id: 'FACULTY', label: 'Faculty', role: 'faculty', requiresBranch: true },
  SCHOLARSHIP_CLERK: { id: 'SCHOLARSHIP_CLERK', label: 'Scholarship Clerk', role: 'scholarship', requiresBranch: false },
  ADMISSION_CLERK: { id: 'ADMISSION_CLERK', label: 'Admission Clerk', role: 'admission', requiresBranch: false },
};

export const FACULTY_BRANCHES = ['CSE', 'CSD', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT'];
```

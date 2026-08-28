# KUCET CMS - Production Readiness & Forensic Audit (Session 208)

**Audit Date:** August 28, 2026  
**Status:** In Development / Pre-Production Release  
**Branch:** `testvanilla`  
**Test Suite Verification:** 50/50 test files passed (372 unit tests passing)

---

## 1. Executive Summary & Synchronization

Recent commits introduced critical architectural evolution:
1. **Hard Breaking Clerk → Staff Migration (`0014_zero_clerk_hard_break.sql`)**:
   - Dropped legacy `clerks` and `clerk_registration_requests` tables.
   - Introduced modular identity schema: `staff_accounts`, `staff_roles`, `staff_account_roles`, `staff_academic_affiliations`, `staff_account_activation_tokens`.
   - Unified cookie engine renaming all authentication references from `clerk_auth` → `staff_auth`.
2. **Faculty Academics Hub & HOD Workflow**:
   - Centralized classroom management at `/staff/faculty/academics` with `/api/staff/faculty/class-lookup`.
   - Dynamic HOD requests (`/staff/hod/requests`, `/api/staff/hod/requests`) and Admin approval console (`/admin/hod-requests`).
   - Academic Calendar restricted to Admin and HOD roles.
3. **Attendance Module Hardening & Topic Covered Modal**:
   - `LectureTopicModal` integrated into faculty attendance workflows.
   - Enforced topic modal trigger **strictly following HTTP 200 persistence** of attendance records.
4. **Admission Drafts & Media Promotion Pipeline**:
   - Two-phase storage lifecycle: Temporary staging (`kucet/requests/`) promoted to permanent student storage (`kucet/students/`) upon finalization via `MediaPromotionService`.

---

## 2. End-to-End Workflow Audit

### 🔐 Authentication & Edge Proxy
- Edge proxy (`src/proxy.js`) uses raw string array `newCookiesToSet` to bypass Next.js header comma-merging bugs.
- Silent refresh triggers seamlessly for expired access tokens when companion session cookies exist.
- Zero residual clerk dependencies remain in active authentication pathways.

### 📋 Attendance Module & Lecture Topic Modal
1. Faculty selects subject assignment and calendar date.
2. Marks attendance status (`PRESENT`, `ABSENT`, `NCC`, `MEDICAL`).
3. `POST /api/staff/faculty/attendance` persists records in `attendance_records`.
4. On HTTP 200 response, `LectureTopicModal` appears on screen.
5. Faculty enters topic (min 2, max 500 chars), which executes `PATCH /api/staff/faculty/attendance/session/topic`.
6. Failed attendance save requests roll back state and prevent the topic modal from opening.

### 🎓 Admission Intake & Media Promotion
1. Applications staged with photos/signatures in `kucet/requests/`.
2. Finalization runs `db.transaction()` promoting files to permanent `kucet/students/` paths and committing `student_images` and `student_signatures`.

---

## 3. Database Schema Status & Production Migration Plan

### Schema Domain Models
- **Identity (`src/db/schema/identity.js`)**:
  - `staff_accounts`, `staff_roles`, `staff_account_roles`, `staff_academic_affiliations`, `staff_account_activation_tokens`
- **Operations (`src/db/schema/operations.js`)**:
  - `faculty_hod_assignments`, `faculty_hod_requests`, `faculty_subject_assignments`, `attendance_sessions`
- **Referential Integrity**:
  - Foreign key constraints on `faculty_hod_assignments.assigned_by`, `faculty_hod_requests.reviewed_by`, and `staff_account_roles.assigned_by` reference `principal.id`.

### Safe Production Migration Steps
1. **Pre-Migration Backup**: Confirm nightly dump exists in `/var/kucet-db-backup/` and generate on-demand snapshot:
   ```bash
   docker exec kucet-cms-db mysqldump -u root -p<DB_PASSWORD> kucet_cms > /var/kucet-db-backup/pre_migration_$(date +%s).sql
   ```
2. **Audit Migration SQL**: Verify `drizzle/0014_zero_clerk_hard_break.sql`.
3. **Execute Migration**:
   ```bash
   npm run db:migrate
   ```
4. **Post-Migration Verification**: Run health check and verify staff login, attendance saving, and admission draft review.

---

## 4. Storage Architecture

- **Canonical Key Format**: All database keys follow `kucet/<category>/<filename>.<ext>`.
- **Zero URL Leakage**: Database never stores full URLs or local absolute disk paths.
- **Client Resolution**: All UI components wrap keys in `getAssetUrl(key)` which seamlessly handles Local Storage (`/api/assets/view/...`) and Cloudinary CDN URLs.

---

## 5. Security & Risk Assessment

| Priority | Module | Issue | Risk | Recommended Action |
| :--- | :--- | :--- | :--- | :--- |
| **P0 - Critical** | **Security** | Exposed root credentials in git history / `.env.production` | Database unauthorized access | Rotate TiDB Cloud / MySQL root passwords in production immediately. |
| **P1 - High** | **Permissions** | VPS storage directory `/var/www/kucet-storage` requires UID 1001 | File upload permission errors | Run `chown -R 1001:1001 /var/www/kucet-storage` on VPS. |
| **P2 - Medium** | **Observability** | QStash Webhook signing key requirements | Async worker fallback | Configure `QSTASH_CURRENT_SIGNING_KEY` in production environment. |

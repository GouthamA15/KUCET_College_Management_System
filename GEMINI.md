# KUCET College Management System - Technical Documentation

**Last Updated:** August 5, 2026 (Session 180)

## 1. Project Overview
A robust, production-ready web application built with **Next.js** for managing the complete academic lifecycle at KUCET. The system supports **Super Admin**, **HOD**, **Clerk/Faculty**, and **Student** roles.

### Core Capabilities:
- **Departmental Management:** Multi-semester timetable orchestration and faculty workload tracking.
- **Real-Time Orchestration:** Instant schedule and activity synchronization via Supabase Broadcast.
- **Admissions & Records:** Multi-stage admission pipeline and comprehensive student registry.
- **Attendance Tracking:** GPS-based, proxy-free attendance with fingerprinting.
- **Internal Marks:** Entry with validation and departmental pattern recommendations.
- **Financial & Certificates:** Scholarship tracking, fee management, and automated digital certificate generation.

## 2. Technical Stack
- **Framework:** Next.js 16 (App Router), React 19, Tailwind CSS 4.
- **Database:** TiDB Cloud (MySQL) with **Drizzle ORM**.
- **Auth:** JWT (HTTP-only) via `jose`, Google OAuth (`next-auth`).
- **Real-Time:** Supabase Realtime (Broadcast) & Redis Pub/Sub (`ioredis`).
- **Security:** AES-256-GCM encryption for PII, SHA-256 blind indexing.
- **Infrastructure:** Sentry (Monitoring), Cloudinary (Storage), Upstash (Rate Limiting/Idempotency).
- **Tooling:** Zod (Validation), Vitest/Playwright (Testing), Pino (Logging).

## 3. Core Architectural Concepts

### A. Database & Type Safety
- **Drizzle ORM:** Centralized schema in `src/db/schema.js`. Uses versioned migrations (`drizzle-kit`).
  - **Safe Database Updates (Data Loss Prevention):** NEVER use `npm run db:push` to update the database schema, as it may drop tables or columns and cause data loss. ALWAYS use the safe migration workflow:
    1. Update `src/db/schema.js`.
    2. Run `npm run db:generate` to generate a `.sql` migration file in `drizzle/`.
    3. Manually review the `.sql` file to ensure no unintended `DROP` statements exist (e.g., if renaming a column, change `DROP` + `ADD` to `RENAME COLUMN`).
    4. Run `npm run db:migrate` to safely apply the changes.
- **Zero-Trust Validation:** Strict Zod schema enforcement on all API boundaries via a unified `wrapHandler`.

### B. Service & Provider Layer
- **Service Layer:** Business logic encapsulated in static Service classes (e.g., `StudentService`, `SecurityService`).
- **Provider Pattern:** Strategy pattern for Email, Storage, and Realtime providers, enabling vendor-agnostic infrastructure.

### C. Security & Robustness
- **Integrity Guard:** SHA-256 fingerprinting for payment evidence to detect fraud/reuse.
- **Circuit Breakers:** Fail-fast utility for external services to prevent cascading hangs.
- **Financial Idempotency:** Registry-backed guards ensuring transactions process exactly once.
- **Session Orchestration:** Real-time remote revocation and device-heuristic tracking.

### D. Time Management
- **Authoritative Clock:** `src/lib/clock.js` (`getNow()`) ensures IST consistency and supports "Time Machine" testing.

## 4. Database Schema Summary
- **Identity:** `students`, `clerks`, `principal`, `user_sessions`, `otp_codes`.
- **Academic:** `college_info`, `academic_calendar`, `syllabus_subjects`, `syllabus_structure`.
- **Registry:** `student_personal_details`, `student_academic_background`, `student_admission_drafts`.
- **Operations:** `student_attendance`, `student_marks`, `branch_timetable`, `faculty_subject_assignments`.
- **Finance:** `scholarship_sanctions`, `student_payments`, `idempotency_keys`.

## 5. Specialized Modules & Features

### **A. Head of Department (HOD) Console**
- **Timetable Matrix:** Semester-aware grid (S1-S8) with "Duplicate Previous" productivity tools.
- **Workload Tracker:** Visual bar charts comparing faculty teaching intensity institution-wide.
- **Branch Analytics:** Condonation risk detection (75% threshold) with student-specific metrics.

### **B. Proxy-Free Attendance System**
- **Architecture:** GPS-based verification (50m radius) and secure 4-digit PINs.
- **Fingerprinting:** IP + User-Agent Lock prevents phone sharing and proxy attempts.

### **C. Real-Time Activity Bars**
- **Pulse Logic:** Both Students and Faculty see a "Live Session" bar detecting current room/subject.
- **Sync:** Updates from HOD timetable changes propagate instantly via Supabase Broadcast.

### **D. Digital Certificate Engine**
- **Architecture:** Server-side PDF rendering using HMAC-SHA256 for tamper detection. Supports Bonafide, TC, NOC, and ID Cards.

## 6. Recent Activity Log (May - August 2026)

#### **Session 180: Dependency Updates & CI Pipeline Hardening (August 5, 2026)**
- **Dependency Updates:** Updated `next-auth` to the latest version.
- **CI Pipeline Hardening:** Rewrote database connection logic (`src/db/migrate.js`, `src/lib/db.js`, `drizzle.config.js`) to natively parse `DATABASE_URL` (12-factor standard connection strings), resolving `ECONNREFUSED` failures during GitHub Actions `db:migrate` pipeline jobs and increasing overall platform resilience for modern cloud deployments.

#### **Session 179: Hosting Strategy Finalization, Student Profile Pic, Sidebar & Finances Refactor (July 26-27 & August 2, 2026)**
- **Official Hosting Budget & Migration Plan (`OFFICIAL_HOSTING_BUDGET_AND_MIGRATION_PLAN.md`):**
  - Consolidated and replaced `PREVIOUS_YEARLY_BUDGET_AND_MIGRATION_PLAN.md` and `YEARLY_BUDGET_AND_MIGRATION_PLAN.md` with a single authoritative document.
  - Evaluated 6 VPS providers: Hostinger KVM 2, Contabo VPS 10, Hetzner CX32, Bluehost NVMe 8, YouStable vPopular, and MilesWeb SM-L3.
  - **College Decision:** Hostinger KVM 2 VPS (2 vCPU / 8GB RAM / 100GB NVMe / Mumbai DC) — Rs.11,839.18/yr (Year 1 with NETWORKCHUCK coupon). Domain: kucet.in (3yr) = Rs.2,122.82. Total Year 1 outlay: Rs.13,962.
  - **Eliminated:** Bluehost (USA server, fatal latency). All YouStable and MilesWeb content removed from all project files.
  - Documented OOM mitigation for 8GB RAM: mandatory 4GB swap file + PDF generation concurrency limiter (max 3 concurrent jobs).
  - Year 2 renewal risk documented: +67% spike → Rs.19,809.84. Calendar reminder strategy in place.
- **Student Profile Pic Feature (`718cb99`):**
  - Fully rebuilt `ProfileHeaderCard.js` (+521 lines, -43) with in-component photo upload UI, live preview, and crop workflow.
  - Enhanced `upload-photo/route.js` with multi-provider storage support, image compression, and validation.
  - Updated `student/image/[rollno]/route.js` and `student/[rollno]/route.js` to serve images from all storage providers.
  - Patched `StudentContext.js` to include pfp invalidation on upload success.
  - Fixed `cloudinary.js` edge case in URL resolution for mixed storage environments.
- **Sidebar Performance & Fee Cards Improvement (`70a9708`):**
  - Optimized sidebar re-render triggers and reduced unnecessary context subscriptions.
  - Refactored fee summary cards for improved data fetching patterns.
- **Finances Page Refactor (`8479a4f`):**
  - Full architectural refactor of the Student Finances page for clarity, data flow separation, and performance.
- **Bonafide Certificate Multi-Purpose (`933b749`):**
  - Extended the Bonafide Certificate request flow to support multiple concurrent purpose submissions in a single request.
  - Updated `validateBonafideEligibility` in `StudentService.js` to track approved purposes per academic year without blocking re-requests for distinct purposes.
- **Reset Password Page (`e7c450c`):**
  - New dedicated reset password UI page with validation, strength enforcement, and token expiry handling.
- **OTP Security Fix (`839637e`):**
  - Resolved a regression where OTPs were being compared incorrectly after the SHA-256 hashing migration in Session 176. Corrected the verify-otp comparison logic.
- **Critical Bug Fixes (August 2, 2026):**
  - **C1 Fixed:** Removed ghost import `_getNow` from `api-utils.js` (non-exported symbol — potential bundler crash).
  - **C2 Fixed:** Replaced raw unsigned `fetch()` PUT in `S3StorageProvider.js` with `@aws-sdk/client-s3` `PutObjectCommand` (SigV4 auth — previous code always returned 403).
  - **C3 Fixed:** Added `s3` and `r2` to `NEXT_PUBLIC_STORAGE_TYPE` Zod enum in `env.js` (app was crashing at startup if those types were configured).
  - **C4 Fixed:** Replaced `getNow()` (IST-shifted Date) with `new Date()` (real UTC) for DB timestamp writes in `SecurityService.logEvent()` and `SecurityService.createNotification()`. `getNow()` is now reserved for business logic and display only.
  - **C5 Fixed:** Refactored `SecurityService.revokeSession()` and `revokeOtherSessions()` from fragile dual-argument-order polymorphism to clean named-options objects.
  - **M1 Fixed:** Rate-limiter now uses module-level Redis singleton (`_getRedisClient()`) instead of creating a new TCP connection on every call.
  - **M6 Fixed:** Added `GOV` to `students.fee_reimbursement` enum in `schema.js` — prevents MySQL constraint error when finalizing GOV-category admission drafts.
  - **YouStable Removal:** Removed all YouStable context from `OFFICIAL_HOSTING_BUDGET_AND_MIGRATION_PLAN.md` and `GEMINI.md`. College selected Hostinger KVM 2.
  - **Deployment Guide Rewritten:** `DEPLOYMENT_PACKAGE/MASTER_DEPLOYMENT_GUIDE.md` fully rewritten for Hostinger VPS with Phase 0 (hPanel SSH), Phase 3 (MySQL RAM tuning), Phase 12 (security hardening), Phase 13 (Cloudflare Tunnel), and deployment health checklist.


#### **Session 178: Category Restructuring, UI Fixes & Scalability Architecture Sprint (July 25, 2026)**
- **SC Sub-Caste Implementation:**
  - Expanded `SC` category into four sub-castes (`SC-A`, `SC-B`, `SC-C`, `SC-D`) across `COLLEGE_CONFIG.categories`, Zod schemas, bulk import logic, and financial reimbursement rules (`financial-utils.js` & `scholarship-utils.js`).
  - Dynamically integrated all four sub-castes into category selection dropdowns across public admission (`/admission`), `AddNewStudent.js`, and `ViewEditStudent.js`.
  - Updated server-side PDF certificate rendering engine (`download/[request_id]/route.js`, `BonafideCertificatePDF.js`, `TransferCertificatePDF.js`, `NoObjectionCertificatePDF.js`) to fetch `category` & `sub_caste` from `student_personal_details` and print `Category/Sub-Caste` details on all issued documents.
- **EWS Category Standardization:**
  - Standardized `OC-EWS` classification to `EWS` repository-wide, updating bulk import sanitization and validation schemas to reject legacy `OC-EWS`/`O-EWS` designations.
- **Admission Form UI Refinement:**
  - Updated Identification Marks field label and placeholders on `/admission` page to explicitly read `26. Identification Marks (As per SSC memo)` and `Identification Mark 1 (As per SSC memo)`.
- **UI Bug Fixes & Adjustments:**
  - **Receipt Modal Layout Fix:** Resolved bottom content cutoff and improper height/overflow constraints in `FeeTransactionHistory.js` by adding `max-h-[92vh]` and vertical scrolling (`overflow-y-auto max-h-[calc(92vh-8rem)]`) to ensure perfect centering and full visibility across viewports.
  - **Profile Edit Button Removal:** Removed `editHref` and `editTitle` props from `ProfileHeaderCard.js` for student views, completely eliminating the edit pencil button from the Student Profile page.
- **Architectural, Scalability & Future-Proofing Enhancements:**
  - **Native Database Partitioning:** Authored `docs/database_partitioning.sql` establishing TiDB Range Partitioning by `date` for `student_attendance` and Hash Partitioning by `student_id` for `student_marks`.
  - **Stateless Cloud Storage:** Engineered `S3StorageProvider.js` supporting AWS S3 and Cloudflare R2 object storage with fallback handling. Updated `storage/factory.js` to support `s3`/`r2` storage types and deprecated `LocalStorageProvider` for production cloud scaling.
  - **Dead Letter Queues (DLQ):** Created `src/app/api/webhooks/qstash/dlq/route.js` to process and persist failed background tasks into Redis (`dlq:failed_jobs`). Updated `enqueueJob` in `queue.js` with `failureCallback` and retry policies.
  - **WebSocket Load Testing Strategy:** Authored `scripts/load-testing/k6-supabase-realtime.js` to simulate E2E WebSocket load testing for Supabase Broadcast channels (`room:attendance`, `room:pulse`).
  - **Automated Schema Migrations:** Integrated automated Drizzle drift verification (`npx drizzle-kit generate`) and automated database migration execution (`npm run db:migrate`) into the GitHub Actions CI pipeline (`.github/workflows/ci.yml`).

#### **Session 177: Remote Changes by GouthamA15 — Student Management UI/UX Improvements (July 25, 2026)**
- **Student History Card Refactor:** Refactored `StudentHistoryCard.js` to simplify history rendering and card layout (~331 lines reworked).
- **Export Students Alignment:** Updated `ExportStudents.js` column mapping, field formatting, and export logic (+116/-116 lines).
- **Student Management Navigation:** Updated `src/app/clerk/admission/student-management/page.js` and `ClerkStudentManagement.js` navigation and context wiring.

#### **Session 176: Auth Security Hardening — Full Audit & Fix Sprint (July 20, 2026)**
- **User Enumeration Elimination (Critical):**
  - `forgot-password/student` GET: Was returning `404` on missing roll numbers — now always returns `200 { is_email_verified: false, has_password_set: false }` regardless of account existence.
  - `forgot-password/student` POST: Was returning `404 "Student not found"` and `403 "not activated"` — both consolidated to a single generic `200 "If an account exists..."` message in all branches including the error handler.
  - `forgot-password/clerk` POST: Was returning `404 "Clerk not found"` — replaced with the same generic `200` message.
- **OTP Security (Critical):**
  - `send-otp/route.js` and `send-update-email-otp/route.js`: OTPs were stored as **plaintext** in the `otp_codes` table. Now stored as **SHA-256 hash** only; the raw OTP goes to email and is never persisted.
  - `verify-otp/route.js`: Added **max 5 attempts / 10 min per identifier** rate limit to block 1M-OTP brute-force attacks.
- **Timing-Safe Comparisons (High):**
  - `verify-otp`: Plain `===` comparison replaced with `crypto.timingSafeEqual(hashOtp(submitted), storedHash)` — eliminates timing oracle on OTP verification.
  - `student/login`: DOB `===` string comparison replaced with `crypto.timingSafeEqual` with 255-byte padded buffers — eliminates timing oracle on date-of-birth login.
- **Per-Account Lockout (High):**
  - `student/login`: Added secondary `login_student_acct:{rollno}` key: **8 attempts / 30 min** in addition to the existing IP-based limit, preventing distributed brute-force.
  - `employee-login`: Added `login_employee_acct:{email}` key: **8 attempts / 30 min** per account.
- **409 Enumeration (High):**
  - `public/admission/route.js`: Three distinct `409` messages (`"email already registered"`, `"mobile already in use"`, `"Aadhaar already registered"`) consolidated to one generic `"Please check your details and try again."` — prevents PII probing via the admission form.
  - `send-update-email-otp`: Was `"This email is already registered to another student"` → same generic `409`.
- **Rate Limiting (Medium):**
  - `forgot-password/admin`, `forgot-password/clerk`, `forgot-password/student`: **3 requests / 15 min per IP** — was completely unprotected.
  - `change-password/student`: **5 requests / 15 min** via tiered device key.
- **bcrypt Cost Factor (Medium):** All `bcrypt.hash()` calls in `reset-password`, `change-password/student`, `change-password/clerk`, `change-password/admin` raised from cost `10` → `12`.
- **Password Strength Validation (Medium):** `reset-password` and all `change-password` routes now enforce: 8+ characters, at least 1 uppercase, 1 lowercase, 1 digit, 1 special character (`PASSWORD_REGEX`).
- **IST Clock Consistency (Medium):** `forgot-password/clerk` and `forgot-password/admin` switched from `Date.now()` to `getNow()` (authoritative IST clock) for token expiry calculation.
- **Reset Token Expiry (Medium):** Extended from 10 minutes → **60 minutes** across all three `forgot-password` routes, matching institutional usability requirements.

#### **Session 175: Remote Changes by GouthamA15 — Feature Optimizations (July 19, 2026)**
- **Student Security Page Refactor:** Rewrote `src/app/student/settings/security/page.js` to consolidate phone and email management into a unified Security Center page (~92 lines added). Integrates `SecurityCenter`, `SecurityOverview`, `SecurityAuthentication`, `SecurityActivity`, and `StudentActivationUI` components with full hook integration (`useSecurityEvents`, `usePasswordManagement`, `useEmailVerification`).
- **Student Settings Cleanup:** Removed legacy `src/app/student/settings/page.js` (10 lines removed) — now superseded by the granular security sub-page.
- **Clerk Edit-Profile Deprecation:** Renamed `src/app/clerk/settings/edit-profile/page.js` → `_page.js` to temporarily disable the stale page without deleting it.
- **Admission Requests Panel Refactor:** `src/components/clerk/requests/AdmissionRequestsPanel.js` heavily refactored — improved layout, sorting, and filter UX with 86 lines reworked across search, filter chips, and pagination controls.
- **ViewEditStudent Enhancement:** `src/components/clerk/student-management/ViewEditStudent.js` improved field validation and display logic (+10 lines).
- **Admission Students API Cleanup:** Removed 2 lines from `src/app/api/clerk/admission/students/[rollno]/route.js` — minor dead-code removal.
- **Date Utility Fix:** `src/lib/date.js` patched to handle edge case in date formatting (+3/-1 lines).
- **Menu Config Update:** `src/lib/menu-config.js` menu items updated to reflect new security page routing (+6/-1 lines).

- **Sidebar Consolidation:** Integrated Admin Infrastructure and HOD Dashboard navigation into the primary `Sidebar.js` pattern, deprecating ad-hoc navigation arrays, page-level drawer modals, and in-page horizontal scroll tabs.
- **Deep Linking Integration:** Converted HOD and Admin UI states to utilize Next.js `useSearchParams()` natively, enabling browser history retention and direct deep-linking (e.g. `?tab=config`) without sacrificing client-side rendering speed.
- **UX Standardization:** Established a singular, institution-wide nested navigation pattern that naturally expands and highlights active child paths, completely eradicating disjointed mobile bottom-sheets across clerk and admin roles.

#### **Session 173: Final Mobile Navigation Refactor (July 2, 2026)**
- **Unified Sidebar Navigation Pattern:** Refactored the HOD Dashboard and Admin Infrastructure mobile views to completely eliminate horizontal scrolling tabs and bottom-sheet drawers. Replaced them with a collapsible sub-navigation drawer mirroring the Student Sidebar interaction pattern (Chevron expand/collapse animations, indented submenu items). This unifies the mobile experience and removes lingering desktop-layout structures.
- **Global Overflow Eradication Verification:** Verified the successful eradication of strict 100vw layout properties across mobile components to guarantee absolute prevention of horizontal scrolling.

#### **Session 172: Final Mobile UX & UI Polish Sprint (July 1, 2026)**
- **Mobile Drawer Architecture:** Redesigned the `Admin Infrastructure` and `HOD Dashboard` page layouts, replacing overflowing horizontal tabs and chips with dedicated, native-feeling Mobile Section Drawers.
- **Stacked Faculty Cards:** Removed rigid width constraints from HOD Faculty Workload cards, allowing them to stack naturally and responsively on mobile viewports.
- **Receipt UX Refinement:** Transformed the `FeeTransactionHistory.js` mobile cards into authentic physical receipts featuring zigzag perforated edge patterns and barcode visualizations.
- **Global Overflow Purge:** Executed an automated DOM audit to eliminate any remaining `100vw` or `min-w-*` fixed widths inside flex containers across all Next.js components, ensuring zero horizontal scrolling on mobile displays.


#### **Session 155: Security, Compression & Alerting Enhancements (June 2026)**
- **Client-Side Image Compression:** Integrated the `compressImage` function across admission and profile upload forms to optimize storage and upload speeds.
- **Session Revocation Guard:** Engineered a session revocation guard in `SecurityService.updateSession` that strictly rejects updates on already-revoked sessions.
- **Nightly Backup Alerting:** Implemented webhook alerting via the `send_alert()` helper function to instantly notify administrators of database or asset backup failures.

#### **Session 154: Universal Image Storage Abstraction & Google Drive Sync (June 22, 2026)**
- **Unified Storage Provider:** Completed the Provider Strategy architecture by implementing a fully robust `LocalStorageProvider` alongside the legacy `CloudinaryStorageProvider`. The system can now toggle entirely between Cloudinary and Local Disk using the `NEXT_PUBLIC_STORAGE_TYPE` environment variable.
- **Codebase Refactor:** systematically migrated 8 distinct API routes (Admissions, Bugs, Profile, Signatures) to consume the centralized `storage.upload()` and `storage.delete()` methods, eliminating scattered hardcoded Cloudinary logic.
- **Backup Strategy Formalization:** Documented the `IMAGE_STORAGE_STRATEGY` explicitly and updated the nightly backup shell script to integrate direct `rclone` syncing with Google Drive for both databases and compressed filesystem assets.

#### **Session 153: Admission Address Logic & Certificate Constraints (June 20, 2026)**
- **Address System Expansion:** Integrated Current and Permanent address fields comprehensively into the DB Schema, Admission Form, Student Profile Cards, and Bulk Import logic, supported by a new `address-utils` utility.
- **Certificate & Request Rigor:** Enhanced the Certificate Request UI and engineered strict Eligibility Constraints for dynamic server-side validation of student requests.
- **Profile & Account Fixes:** Resolved static academic year issues, ensuring student dashboards dynamically fetch their correct year/semester contexts regardless of global calendar states.
- **Codebase Optimization:** Consolidated redundant hooks (`hooks/student/hooks` flattened) and removed the `vite` dependency to patch a known security vulnerability.

#### **Session 152: Global Image Standardization (June 9, 2026)**
- **Image Upload Hardening:** Standardized all image upload size limits to strictly **less than 1MB** project-wide. 
- **Institutional Alignment:** Synchronized limits across the Admission Portal, Clerk Student Management, and Developer Bug Reporting modules to ensure infrastructure cost-efficiency and performance.
- **UX & Validation:** Updated client-side validation logic and UI hints to provide immediate feedback on the new 1MB threshold, reducing server-side rejection overhead.

#### **Session 151: Security Hardening & Financial Alignment (June 9, 2026)**
- **Security Hardening:** Transitioned from insecure `Math.random()` to `crypto.getRandomValues()` for the `generateStrongPassword` utility, incorporating a secure Fisher-Yates shuffle for password permutations.
- **Financial Alignment:** Synchronized scholarship sanction validation limits (Zod schemas) with institutional payment caps, raising the threshold to 150,000 to accommodate high-value professional course disbursements.
- **UX & Resilience:** Hardened the email verification OTP timer with proper cleanup logic to prevent memory leaks and race conditions. Improved clipboard interaction feedback in the security center.

#### **Session 150: Scholarship Integrity & Financial Hardening (June 7, 2026)**
- **Dashboard Restoration:** Resolved critical data-fetching regressions by restoring snake_case compatibility aliases in `FinanceService` and enriching the summary API with derived academic metadata (admission year, course).
- **Strict Financial Guardrails:** Re-engineered a strict "Payment Not Possible" block for institutional fee payments to prevent overpayments beyond the student's annual required limit.
- **Registry Automation:** Integrated a student promotion trigger; recording a scholarship sanction now automatically updates the student's status to **"FEE REIMBURSEMENT: YES"** in the registry.
- **UX Safety & Resilience:** Implemented mandatory browser confirmation prompts for all financial record deletions and resolved a `proceedings` initialization race condition in the scholarship modal.
- **Mobile Experience:** Refactored the Student Dashboard UI for mobile-first accessibility, optimizing action centers and layout flow.

#### **Session 149: Student Activation & Registry Integrity (June 7, 2026)**
- **Mandatory Activation Workflow:** Engineered an `ActivationGuard` and functional `SetPasswordModal` that forces new students to verify email and set secure credentials before dashboard access.
- **Credential Convenience:** Integrated a cryptographically secure `generateStrongPassword` utility with one-click generation and mandatory "Save to WhatsApp" security reminders.
- **Lateral Registry Logic:** Aligned `getAcademicYear` and Excel Migration exports with institutional batch continuity rules, ensuring Lateral students (TG ECET) are correctly grouped with their graduation cohorts.
- **UX Hardening:** Added resend OTP countdowns and context-aware email subjects ("Activate Account" vs "Verify Email") to the security onboarding flow.

#### **Session 148: Critical Bug Fixes & Production Hardening (June 6, 2026, 20:30 IST)**
- **Concurrency & SQL Hardening**: Verified `updateTimetableAtomic()` and `updateMarkAtomic()` fixes for consistent scalar result handling. Resolved unsafe raw SQL ordering issues in timetable queries.
- **Institutional Logic Integrity**: Hardened Bonafide "Pay Once" verification to prevent unintended free certificates in same-year resubmissions.
- **Validation Excellence**: Successfully executed full project validation suite. All **84 unit tests** PASSED. Achieved and maintained **>80% global branch coverage**.
- **System Stability**: Verified Next.js 16 (Turbopack) production build with zero errors. Fixed all remaining linting dependencies.

#### **Session 147: Institutional Architecture & Logic Hardening (June 6, 2026)**
- **Bonafide 'Pay Once' Logic**: Engineered a lifetime fee waiver system with strict course duration caps (4 for Regular, 3 for Lateral entry) and academic year limits.
- **Universal Integrity Guard**: Centralized multi-vector fraud detection (SHA-256 screenshot fingerprinting and global UTR uniqueness) in `FinanceService`, protecting both Fee Payments and Certificate Requests.
- **Institutional Service Layer**: Consolidated massive boilerplate into shared `StudentService`, `FinanceService`, `ScholarshipService`, and `FacultyService`, removing over 600 lines of redundant code.
- **Unified Student Data Path**: Manual admission, bulk imports, and draft finalization now share a single secure logic path (`upsertStudent`), ensuring consistent encryption and blind indexing.
- **API Orchestration**: Refactored high-stakes APIs (Profile, Search, Summary, Metrics, Timetable) to use `wrapHandler` for centralized zero-trust validation, auth, and telemetry.
- **Quality Assurance Milestone**: Achieved and verified **>80% global branch coverage** (verified via `test:coverage`) with new dedicated service-level test suites.
- **Time-Travel Testing**: Standardized authoritative IST mock clock (`getNow()`) usage across all modules for consistent testing.

#### **Session 145-146: API Orchestration & Financial Oversight (June 2026)**
- **Naming Modernization:** Transitioned from legacy `TS EAMCET/ECET` to **`TG EAPCET/ECET`**.
- **Unified API Wrapper:** Engineered `wrapHandler` for centralized Zod, Auth, and Performance Telemetry.
- **Finance Unit:** Developed `FinanceService` for cross-table oversight of Fees and Scholarships.

#### **Session 140-144: Security, Robustness & Zero-Trust (June 2026)**
- **Circuit Breakers:** Integrated failure protection for external providers (Email, Supabase).
- **Financial Idempotency:** Added registry-backed guards to prevent duplicate Sanctions/Payments.
- **Integrity Guard:** Launched SHA-256 fingerprinting for payment screenshot verification.
- **Staff Login Sovereignty:** Relaxed validation for legacy clerk accounts while hardening new student registration.

#### **Session 135-139: Architecture Sovereignty & Session Management (May 2026)**
- **Provider Strategy:** Implemented abstract Providers for Email, Storage, and Realtime.
- **Session Trust:** Launched remote revocation and device-heuristic tracking in the Security Center.
- **Attendance Integrity:** Implemented mandatory GPS accuracy thresholds and Offline-First faculty fallback (IndexedDB).
- **Admission Resilience:** Added `localStorage` draft persistence for applicant forms.

#### **Session 130-134: Concurrency & Institutional Logic (May 2026)**
- **Optimistic Locking:** Added version-based guards for Marks and Timetable updates.
- **Referential Integrity:** Developed `ValidationService` to prevent deletion of entities with active dependencies.
- **Roll Number Excellence:** Hardened generation logic for Lateral Entry (TG ECET) batch continuity.

#### **Session 156: Comprehensive Edge Case & Concurrency Audit (June 2026)**
- **Codebase Auditing:** Executed a system-wide audit for unhandled edge cases, identifying severe concurrency, validation, and timezone-related workflow errors.
- **Race Condition Resolutions:** Refactored `StudentService.upsertStudent` and `IdempotencyService` to use safe `ON DUPLICATE KEY UPDATE` and structured `try/catch` wrappers instead of sequential check-then-insert flows, preventing unhandled 500 crashes during rapid multi-submission scenarios.
- **Strict Database Uniqueness:** Upgraded database integrity by adding `uniqueIndex` constraints to `student_id` in profile tables and strictly fingerprinting `transaction_ref_no` (UTR) in `studentFeePayments` to physically prevent duplication at the storage layer.
- **Timezone Safety (Serverless):** Resolved critical timezone logic bugs where UTC native `Date` functions incorrectly evaluated against IST `getNow()` utility functions across OTP, password resets, and proxy-free attendance modules, which previously caused instant false-expirations on globally distributed hosting.
- **Validation Continuity:** Added missing dependency protection for `certificateVerificationsArchive` within the global `ValidationService`.
- **Database Schema Sync Bypass:** Engineered a script to manually push valid unique indexes directly to TiDB Cloud using raw SQL, intentionally bypassing Drizzle Kit's TTY truncation prompts triggered by existing database duplicate entries.
- **Environment Bootstrapping Fix:** Resolved a silent fail bug in `src/lib/db.js` where `dotenv` failed to load decrypted variables when `.env.local` was missing, ensuring `query()` executes reliably in offline-first scripts.

#### **Session 157: Code Quality & Linting Compliance (June 2026)**
- **ESLint Reactivation:** Re-enabled and strictly enforced all project ESLint rules, resolving over 390+ accumulated linting warnings without hiding or disabling rules.
- **Global Code Cleanup:** Programmatically and manually cleaned unused variables, removed extraneous `console.log` statements, and fixed regex escape syntax errors across 165+ component and API route files.
- **Strict Compliance:** Configured `caughtErrorsIgnorePattern` to safely allow `_e` exception handling variables while maintaining strict variable usage policies project-wide.
- **Validation Excellence:** Maintained 100% passing unit tests (103/103) and high branch coverage (>80%) following massive codebase refactoring.

#### **Session 158: Session Integrity & Mobile Header Expansion (June 20, 2026)**
- **Session Continuity (GouthamA15):** Resolved random logout bugs and session mismatch errors by heavily refactoring `AdminContext`, `ClerkContext`, and `StudentContext` with robust state-sync tracking and lifecycle management (`activePromiseRef`, bfcache restoration). Added `SecurityService` session verification to strictly reject already-revoked tokens.
- **Mobile Navigation (GouthamA15):** Integrated the responsive `Header-MobileView` across previously orphaned global routes (`/dev`, `/developers`, `/verify`, and `/reset-password`), unifying the institution's mobile aesthetic.
- **Continuous Integration (GouthamA15):** Hardened the `admission.spec.js` Playwright tests to align with recent multi-step form schema changes.
- **Console Log Cleanup (GouthamA15):** Purged debugging `console.log` statements from `RealtimeListener.js` to prevent memory leaks and noise in production consoles.

##### **Session 159: Universal Legal Compliance & GPS Privacy Controls (June 25, 2026)**
- **Legal Architecture:** Engineered strict `/privacy-policy` and `/terms` public pages governing data retention, AES-256-GCM encryption transparency, and location access rules. Integrated them into the global institutional `Footer`.
- **Zero-Trust Admission Consent:** Hardened the `/admission` pipeline with a mandatory `legal_consent` Zod validation constraint and UI checkbox. Automatically records `data_policy_consented_at` timestamps using precise IST clocks (`getNow()`) directly into the Drizzle ORM registry.
- **Just-In-Time GPS Privacy:** Re-architected the `AttendanceVerificationActivity` to strictly prompt for explicit Location Tracking Consent *before* executing the `navigator.geolocation` API. Consent is verified against `localStorage` and centrally logged to the `students` DB table (`gps_consent_granted_at`) via a new `POST /api/student/consent/gps` endpoint.
- **Transparent Cookie Policy:** Built a universally rendering `CookieBanner` injected directly into the Next.js `layout.js`, providing clear UX communication regarding the use of HTTP-only session cookies and offline-first LocalStorage.

#### **Session 160: Navigation & Advanced Session Management (June 29, 2026)**
- **Security & Session Sovereignty:** Engineered advanced API routes (`/api/auth/sessions/revoke-others`) and enhanced `SecurityService` to allow users to remotely revoke active sessions on other devices. Implemented a robust `SecurityCenter` UI to visualize and manage active sessions.
- **Navigation & Layout Unification:** Re-architected the global navigation framework, standardizing `AdminSidebar`, `Sidebar`, and `Navbar` components across all roles (Admin, Clerk, Student) for improved mobile responsiveness and architectural consistency.
- **Contextual State Enrichment:** Upgraded `StudentContext` to deeply integrate with the new security notification APIs, ensuring immediate client-side awareness of session revocations and critical security events.
- **Testing Integrity:** Expanded unit testing suite (`SecurityService.test.js`, `refresh.test.js`) to strictly validate the new session management logic and ensure uninterrupted authentication flows.

#### **Session 161: QR Attendance Enhancements & SSR Fixes (June 29, 2026)**
- **Camera Resource Safety:** Refactored QRScannerPanel rendering in page.js to conditionally mount based on window.innerWidth, preventing dual instances in DOM from crashing the html5-qrcode library and causing Illegal constructor errors.
- **QR Validation Integrity:** Hardened handleQRScan across Desktop and Mobile attendance sheets with strict working-date/session precondition checks, preventing faculty from marking QR attendance prior to selecting valid dates.
- **UI Completeness:** Resolved missing History icon import in AttendanceHistoryViewer for correct icon rendering.

#### **Session 162: Attendance Status Enhancements & API Typo Fixes (June 29, 2026)**
- **API Refactoring:** Fixed a critical typo across students/route.js, marks/route.js, FinanceService.js, and attendance-analytics/route.js where academic_status was incorrectly compared against 'ACTIVE' instead of student_status.
- **History View:** Upgraded AttendanceHistoryViewer to support NCC and MEDICAL statuses with distinct color rendering alongside standard PRESENT and ABSENT statuses.
- **Detailed Expansion:** Enhanced AttendanceHistoryViewer with an interactive dropdown table allowing faculty to instantly view student-by-student roll calls per session.
- **API Payload Normalization:** Modified /api/clerk/faculty/attendance/full-history to explicitly join the students table to fetch roll_no and name without client-side waterfalls, and wrapped the payload in standard { data: ... } struct for frontend type-safety.

#### **Session 163: QR Code & Roll Number Integrity (June 29, 2026)**
- **QR Scanning Robustness:** Engineered an advanced regex extraction pattern (`HT-No\s*:\s*([A-Za-z0-9]+)`) in `QRScannerPanel` to instantly parse both raw roll numbers and dense institutional student ID strings, resolving bugs where verbose QR codes crashed the scanner logic.
- **Roll Number Extensibility:** Upgraded global `rollNumber.js` validation to officially support alphanumeric serial sequences (e.g., `A1`, `B2`) critical for large batches exceeding 99 students, while also introducing tolerant parsing for Lateral Entry formats (`567T` vs `567`).

#### **Session 164: Future-Proofing & Extreme Scalability (June 29, 2026)**
- **Background Job Offloading (QStash):** Migrated bulk system email tasks to Upstash QStash queues. This completely eliminates 504 timeouts on Vercel's API limits during mass data ingestion or student notifications.
- **Data Archiving Infrastructure:** Engineered the foundational `/archive-data` endpoint explicitly for `student_attendance` and `student_marks` tables. This acts as the groundwork for automated end-of-year table partitioning, ensuring the primary operational tables remain lighting-fast regardless of institutional growth.
- **Strict OTP Security Wrappers:** Encapsulated the authentication endpoints with an ironclad IP-based Upstash Rate Limiter (capped at 3 requests per 10 minutes), fundamentally stopping massive email/quota abuse at the edge.
- **CI/CD Cloud Transition:** Fully decommissioned the heavy local `next build` command from Husky pre-commit hooks (which caused severe `.git/index.lock` collisions and developer machine throttling). Transitioned to a rigorous **GitHub Actions CI Pipeline** (`.github/workflows/ci.yml`), enforcing `eslint`, `vitest run`, and `next build` on a clean, isolated cloud node before any code reaches `testvanilla` or `main`.

#### **Session 165: Hardware Access, QR Scanning & Turbopack Routing Fixes (June 29, 2026)**
- **Hardware Permission Unblocking:** Fixed a critical deployment issue on Render by modifying the global `Permissions-Policy` header in `next.config.mjs` to `camera=(self)`. This prevents browsers from silently blocking camera access and properly restores the device permission pop-up for QR scanning on mobile devices over HTTPS.
- **Robust QR Extraction Engine:** Engineered a multi-layered regex fallback engine in `QRScannerPanel.js` (`\b(\d{2}567T?\d{2}[A-Za-z0-9]{2,3})\b/i`). This resolves scanner freezes caused by dense ID cards missing standardized `HT-No` labels by scanning the entire text payload for any substring matching the KUCET roll number pattern.
- **Turbopack JSON Parsing Fix:** Resolved a critical `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` client-side crash in the Attendance Session API. Identified and removed an invalid `_sql` import from `drizzle-orm` in `route.js` which was causing Turbopack to crash during compilation and silently return a 500 HTML Error Page instead of the expected JSON payload. Also optimized dynamic module loading (`clock.js`) to static top-level imports for Edge stability.

#### **Session 166: Universal QR Extraction & Roll Number Integrity (June 30, 2026)**
- **Universal QR Code Parsing:** Deprecated fragile text-label matching (e.g., `HT-No : `) in `QRScannerPanel.js` due to real-world formatting inconsistencies across printed ID cards. Replaced it with a robust, greedy pattern-matching algorithm that universally extracts the KUCET roll number from anywhere within a dense QR payload.
- **Strict Format Constraints:** Engineered a bifurcated regex architecture that physically guarantees extraction integrity. The pattern strictly mandates either the presence of a `T` immediately following the college code (for Regular students) or an `L` suffix (for Lateral students). This completely eliminates the possibility of the scanner falsely recognizing phone numbers or unformatted strings as attendance identifiers.
- **Scanner Hardware Acceleration:** Optimized QR recognition speeds by enabling `useBarCodeDetectorIfSupported: true` to leverage native mobile hardware decoding (bypassing JS/WASM overhead).
- **Boosted Capture Frequency:** Upgraded scanner configuration from 10 FPS to 25 FPS, resulting in significantly snappier frame processing and near-instantaneous QR extraction.

#### **Session 167: UI Refactor – HOD Dashboard Separation (July 1, 2026)**
- Removed HOD dashboard links from Faculty dashboard and added a dedicated HOD menu entry in the sidebar.

#### **Session 168: Bulk UI Refactor – Admin & Clerk Pages (July 1, 2026)**
- Updated admin dashboard, clerk layout, and student pages for UI consistency.
- Refactored 35 components and pages (see git diff summary): 2,718 insertions, 1,365 deletions.
- Ensured lint compliance; no ESLint errors.
- Build and tests passed; no runtime crashes detected.

#### **Session 169: Concurrency, Validation & UI Accessibility Hardening (July 1, 2026)**
- **Database Schema & TOCTOU Elimination:** Added database unique constraint `uq_faculty_subject_assignment` on `facultySubjectAssignments` and replaced existence checks with `.onDuplicateKeyUpdate()` atomic upsert transactions in admin approval (`approve-interest`) and clerk HOD interest approval routes.
- **HOD Faculty Interest Orchestration:** Added `is_active = true` filter to HOD allocated subquery, updated rejection logic to automatically set matching active assignments to `is_active: false`, and migrated routes to `wrapHandler` with Zod validation.
- **Roll Number Canonicalization:** Created `canonicalizeRollNo()` utility in `rollNumber.js` and integrated it into `AttendanceSheet.js` for robust QR scan roll matching.
- **Async State & UI Refinements:** Awaited async UI state updates (`fetchInterests` and `refreshHOD`) in `HODConsole.js` action handler, added `renderValue` helper in `StudentUpdateRequestsPanel.js` to correctly display falsy values like `0` and `false`, and ensured `setFetchedList([])` resets search results on form clear in `FetchStudent.js`.
- **Validation & Accessibility:** Enabled and surfaced annual income limit (`> 2,000,000`) validation error messages in `AddNewStudent.js`, guarded `ViewEditStudent.js` Clear Record action with an unsaved edits confirmation prompt, and converted `StudentHistoryCard.js` toggle header from `<div onClick>` to `<button type="button">` for keyboard and screen reader accessibility.
- **Clean Component API:** Replaced underscored parameter list aliases in `StudentTopBar.js` with clean direct destructuring `({ title, subtitle, breadcrumb, onMenuClick })`.

#### **Session 170: UI Polish & Bug Fixing Sprint (July 1, 2026)**
- **Faculty Profile Picture Loading & Fallback Enhancements:** Resolved profile picture rendering failures in faculty class rosters (`MobileAttendanceSheet.js`, `ClassList.js`, `AttendanceSheet.js`), student management profile views (`ViewEditStudent.js`), and admission verification modals (`AdmissionModal.js`). Integrated robust `onError` image fallback handlers across all views to display clean initials or "Image Unavailable" placeholders and stop infinite loading spinners when asset URLs are broken or unreachable.
- **Student Financial Page Enhancement (`/student/finances`):** Built a modern, mobile-first financial ledger with 4 high-impact Summary Cards (Total Course Fee, Total Amount Paid, Pending Due Balance, Scholarship Coverage) with dynamic color-coding and warning indicators. Implemented visual status badges (`Fully Paid`, `Partial`, `Overdue`, `Credit`) across all academic year rows and transaction cards. Developed `FeeTransactionHistory.js` with expandable transaction details and an interactive official KUCET Fee Payment Receipt modal featuring institutional headers, verification seals, and one-click PDF printing.

#### **Session 171: Final Production Mobile & UX Refinement Sprint (July 1, 2026)**
- **Infinite Loop Fixes:** Addressed severe performance issues (~1 minute load times) on Faculty and HOD dashboards by debugging infinite re-rendering loops caused by broad `useEffect` dependencies in `AssignedSubjectsList.js`, `ClassList.js`, and `SubjectInterestForm.js`. Introduced local state initialization flags to guarantee single-pass rendering.
- **Admin Infrastructure Mobile Layout:** Resolved desktop-layout squeezing issues on mobile viewports for the Admin Infrastructure Page. Reduced title sizing for proper wrapping, eliminated horizontal scrolling, standardized grid gaps/padding, and replaced fixed tabs with horizontally scrollable, full-width navigation chips.
- **HOD Dashboard App-Like Navigation & Stacked Cards:** Re-engineered the Departmental Management Matrix navigation bar into responsive scrollable chips. Completely refactored the Faculty Load cards (`WorkloadView`) to stack metrics (Avatar, Name, Email, Load, Performance) vertically on mobile to prevent squeezed side-by-side elements, ensuring proper visual hierarchy on `< 768px` screens.
- **Student Timetable Gesture Integration:** Upgraded the mobile timetable from static buttons to a fluid, gesture-based component (`ClassTimetable.js`). Added native `onTouchStart`, `onTouchMove`, and `onTouchEnd` swipe handlers to allow students to effortlessly swipe left/right across different days of the week, mimicking standard mobile OS design paradigms.
- **Student Finance Physical Receipt Simulation:** Re-designed the dense data tables in the mobile view of `FeeTransactionHistory.js` into standalone Receipt Cards. Integrated a custom CSS `clipPath` zigzag cutout at the bottom of the card header to visually simulate physical printed bank receipts, adding robust verification seals and structured key-value data rows for maximum scannability on small screens.

- **Global Horizontal Overflow Audit:** Deployed a codebase-wide layout audit targeting and stripping hardcoded \w-screen\, \min-w-screen\, and rigid desktop paddings (\p-8\, \px-10\). Applied \w-full\ and responsive spacing (\p-4 sm:p-8\) globally, entirely eliminating mobile layout breakage and horizontal scrollbars.
- **Global Image Stability:** Systematically parsed and injected native \onError\ fallback handlers into 27 critical components utilizing \<Image>\ and \<img/>\. Broken Cloudinary assets or missing file blobs now gracefully degrade to informative 'Image Not Found' placeholders instead of shattering flexbox and grid layouts.

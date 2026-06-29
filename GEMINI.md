# KUCET College Management System - Technical Documentation

**Last Updated:** June 29, 2026 (Session 160)

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

## 6. Recent Activity Log (May - June 2026)

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

#### **Session 159: Universal Legal Compliance & GPS Privacy Controls (June 25, 2026)**
- **Legal Architecture:** Engineered strict `/privacy-policy` and `/terms` public pages governing data retention, AES-256-GCM encryption transparency, and location access rules. Integrated them into the global institutional `Footer`.
- **Zero-Trust Admission Consent:** Hardened the `/admission` pipeline with a mandatory `legal_consent` Zod validation constraint and UI checkbox. Automatically records `data_policy_consented_at` timestamps using precise IST clocks (`getNow()`) directly into the Drizzle ORM registry.
- **Just-In-Time GPS Privacy:** Re-architected the `AttendanceVerificationActivity` to strictly prompt for explicit Location Tracking Consent *before* executing the `navigator.geolocation` API. Consent is verified against `localStorage` and centrally logged to the `students` DB table (`gps_consent_granted_at`) via a new `POST /api/student/consent/gps` endpoint.
- **Transparent Cookie Policy:** Built a universally rendering `CookieBanner` injected directly into the Next.js `layout.js`, providing clear UX communication regarding the use of HTTP-only session cookies and offline-first LocalStorage.

#### **Session 160: Navigation & Advanced Session Management (June 29, 2026)**
- **Security & Session Sovereignty:** Engineered advanced API routes (`/api/auth/sessions/revoke-others`) and enhanced `SecurityService` to allow users to remotely revoke active sessions on other devices. Implemented a robust `SecurityCenter` UI to visualize and manage active sessions.
# KUCET College Management System - Technical Documentation

**Last Updated:** June 29, 2026 (Session 160)

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

## 6. Recent Activity Log (May - June 2026)

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

#### **Session 159: Universal Legal Compliance & GPS Privacy Controls (June 25, 2026)**
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
- **API Refactoring:** Fixed a critical typo across students/route.js, marks/route.js, FinanceService.js, and  ttendance-analytics/route.js where  cademic_status was incorrectly compared against 'ACTIVE' instead of student_status.
- **History View:** Upgraded AttendanceHistoryViewer to support NCC and MEDICAL statuses with distinct color rendering alongside standard PRESENT and ABSENT statuses.
- **Detailed Expansion:** Enhanced AttendanceHistoryViewer with an interactive dropdown table allowing faculty to instantly view student-by-student roll calls per session.
- **API Payload Normalization:** Modified /api/clerk/faculty/attendance/full-history to explicitly join the students table to fetch oll_no and 
ame without client-side waterfalls, and wrapped the payload in standard { data: ... } struct for frontend type-safety.

# KUCET College Management System - Technical Documentation

**Last Updated:** June 10, 2026 (Session 154)

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

## 7. Deployment & Self-Hosting Architecture (Local Sovereign)

### A. Infrastructure Overview
- **Target OS:** Ubuntu/Debian Linux (Local Server).
- **Containerization:** Full Docker Compose orchestration for isolation and portability.
- **Stack:** Nginx (Proxy), Next.js (App), MySQL 8.0 (DB), Redis 7 (Cache), Uptime Kuma (Monitoring).

### B. Storage Strategy (Local Sovereign)
- **Local Sovereignty:** Transitioned from Cloudinary to local filesystem volumes for performance and cost-efficiency.
- **Unified Vault:** `/var/www/kucet-storage/public` (mapped to `/app/public/uploads`). Stores all assets including logos, profile photos, signatures, and payment screenshots.
- **Permissions:** Restricted to Docker UID `1001` with `755` masks.

### C. Networking & Access
- **Tunneling:** `cloudflared` tunnel provides secure access to `login.kucet.ac.in` without exposing local ports.
- **Direct Access:** Bypass Cloudflare 100MB limits via local IP/Tailscale for massive bulk imports.
- **Security:** UFW (Uncomplicated Firewall) and Fail2Ban active on host.

### D. Resilience & Maintenance
- **Auto-Recovery:** BIOS-level "Power-On" and Systemd service persistence for Docker/Cloudflared.
- **Backups:** Nightly `docker exec` MySQL dumps stored in `/var/backups`.
- **Offsite Sync:** Rclone-driven synchronization to Google Drive/S3 at 4:00 AM daily.

## 8. Recent Activity Log (June 2026)

#### **Session 159: Database Restoration & Sovereign Asset Recovery (June 13, 2026)**
- **Database Restoration (Old Backup):** Successfully restored the `college_db.sql` backup following a schema corruption event. Orchestrated the recovery via a surgical shell script (`fix_db.sh`) that re-injected the missing `version` columns and `system_configs` table without manual SQL errors.
- **Institutional Seeding:** Programmatically restored institutional defaults (NAAC A+ accreditation, fee structures, and campus address) directly into the `system_configs` table to ensure UI consistency.
- **Asset Recovery (Cloudinary Sync):** Recovered over **200 missing assets** (PFPs, signatures, payment proofs) from Cloudinary that were absent from the local storage migration.
- **Institutional Asset Consolidation:** Purged 30 duplicate public assets from Cloudinary and consolidated the server's sovereign storage by removing redundant copies of Git-tracked assets.
- **Storage Hardening:** Centralized recovered assets into the sovereign vault (`/var/www/kucet-storage/public/kucet`) and strictly hardened permissions (Directories: 755, Files: 644) under UID 1001 for maximum security and Nginx performance.
- **Sidebar Accessibility Fix:** Resolved a high-priority console warning (`aria-hidden`) in the mobile navigation drawer by ensuring active elements are blurred upon menu closure.
- **Build & Integration Fixes:** Resolved critical build errors in the scholarship API by correcting import patterns for `IdempotencyService` (default vs named) and `apiResponse`. Fixed logic in `SystemConfigService` to prevent DB constraint violations.
- **Validation Milestone:** Verified the entire application via `npm run build` and executed the full test suite. All **84 unit tests** PASSED, confirming zero regressions across core services (Student, Finance, Scholarship).
- **Cleanup & Optimization:** Purged legacy artifacts (`share-modal.js`) and temporary restoration scripts from the server, achieving a zero-error production console.

#### **Session 158: Production Hardening, Student UX, & Concurrency (June 12, 2026)**
- **Public Network Access (Tailscale Funnel):** Configured Tailscale Funnel to securely route public internet traffic to the Nginx container (Port 80). Resolved `ERR_NAME_NOT_RESOLVED` issues by ensuring the host node was explicitly whitelisted in the Tailscale Admin Console ACLs (`"attr": ["funnel"]`), allowing the `.ts.net` domain to resolve globally without requiring the Tailscale client app on mobile devices.
- **Manual Schema Migration:** Bypassed `drizzle-kit push` for the `scholarship_sanctions` versioning column to avoid potential data-loss warnings. Executed a raw SQL migration directly inside the production MySQL container (`docker exec -i kucet-cms-db mysql ... ALTER TABLE`) to safely inject the `version` column, instantly resolving subsequent 500 Internal Server Errors on student profile loads.
- **Student Portal Focus:** Restricted student access exclusively to Profile, Finances, and Certificates. Blocked under-development routes (Dashboard, Academics, Timetable, ID Card) at the Next.js Proxy level and removed them from global navigation to prevent confusion.
- **Real-Time Verification Toasts:** Engineered instant, WebSocket-driven toast notifications using `RealtimeListener` to alert students immediately when clerks approve their certificates or record fee payments, bypassing the need for manual page refreshes.
- **Sovereign Image Optimization:** Integrated `sharp` into `LocalStorageProvider` to automatically downscale and compress high-resolution mobile uploads (PFPs, signatures, payment screenshots) to WebP format. Increased raw upload limits to 5MB while keeping disk storage under ~800KB per file.
- **Lateral Entry Refactoring:** Corrected course duration and studying year logic in `rollNumber.js` for TG ECET (Lateral) students. Successfully clamped institutional batch generation (e.g., 2023-2026) and certificate rendering exclusively to 3 years.
- **Financial Concurrency (Optimistic Locking):** Hardened the `ScholarshipService` and API routes with strict version-based guards (`original_version`) to prevent race conditions during simultaneous clerk updates to scholarship sanctions.
- **Offline-First Admission Resilience:** Transitioned the Admission Draft auto-save mechanism from limited `localStorage` to a robust `IndexedDB` wrapper (`idb-admission.js`), ensuring students don't lose large image uploads during network drops.

#### **Session 157: Legacy Asset Recovery & Storage Resilience (June 11, 2026)**
- **Certificate Engine Asset Embedding:** Fixed React-PDF generation to fetch institutional assets (Principal signature, college seal) dynamically from the local storage volume instead of strictly from the static repository `public/` directory, resolving missing images in downloaded certificates.
- **Legacy Path Recovery:** Engineered an intelligent "Path Discovery" layer in `getAssetUrl` and `LocalStorageProvider` that automatically recovers legacy Cloudinary IDs by re-mapping them to the correct institutional folders (`kucet/students/pfp/`).
- **Filesystem Permission Hardening:** Standardized directory (`755`) and file (`644`) permission masks in `LocalStorageProvider` to ensure cross-container Nginx readability in self-hosted environments.
- **Environment Sanitization:** Hardened `env.js` with automatic trimming and sanitization of `LOCAL_STORAGE_PATH` to prevent service crashes caused by stray characters (spaces/dots) in institutional `.env` files.
- **Nginx Fallback Strategy:** Implemented a robust `try_files` fallback in Nginx that attempts high-speed filesystem serving but automatically proxies to the app's internal asset API if permissions or paths fail, and refined volume mappings explicitly using `alias`.
- **Code Quality & Validation:** Handled trailing promises in logging, hardened magic-bytes detection for WebP and GIF formats, and fixed naming inconsistencies for institutional static assets (NAAC logo).

#### **Session 156: Asset Resilience & Storage Hardening (June 11, 2026)**
- **Global Upload Standardization:** Doubled the system-wide upload limit to **2.00MB** across all modules (Admission, Payments, Profiles, Bug Reporting) to accommodate high-resolution mobile screenshots and modern profile photos.
- **Storage Diagnostics:** Engineered a "Startup Health Check" in `LocalStorageProvider` that verifies volume writability on server boot, providing proactive feedback for self-hosted permission conflicts (UID 1001).
- **Asset URL Resilience:** Hardened `getAssetUrl` with intelligent path normalization to prevent "double-prefixing" regressions during the transition to local sovereign storage.
- **Clerk Portal Optimization:** Purged defunct navigation routes (e.g., `/clerk/faculties`) from the menu configuration to eliminate 404 dead-ends and streamline institutional workflows.
- **Security Artifact Cleanup:** Investigated and confirmed `share-modal.js` as a legacy/cached artifact, ensuring codebase hygiene.

#### **Session 155: Auto-Deployment & CI/CD Orchestration (June 10, 2026)**
- **GitHub Actions CI/CD Pipeline:** Engineered a robust auto-deployment workflow (`.github/workflows/deploy.yml`) that triggers on pushes to the `testvanilla` branch.
- **Secure SSH Orchestration:** Implemented the `appleboy/ssh-action` to securely log into the self-hosted server, pull the latest code, and orchestrate Docker container restarts.
- **Restricted Deployment User:** Established a dedicated `deployer` user on the server with limited permissions, added to the `docker` group, and granted ownership of the project directory (`/var/www/kucet-cms`) for enhanced security.
- **Schema Synchronization:** Integrated automatic `npm run db:push` into the deployment script to ensure database schema changes are applied immediately upon code update.
- **Infrastructure Cleanup:** Added automatic Docker image pruning to the deployment pipeline to prevent disk space exhaustion on the self-hosted server.

#### **Session 155: Auto-Deployment & Tailscale SSH Orchestration (June 10, 2026)**
- **Tailscale SSH CI/CD Pipeline:** Successfully engineered a 100% automated deployment workflow (`.github/workflows/deploy.yml`) using Tailscale SSH.
- **Verification Bypass:** Configured Tailscale ACLs with `action: accept` for `tag:ci` to eliminate manual browser verification links, enabling true "lights-out" automation.
- **Identity-Based Auth:** Transitioned from manual SSH keys to Tailnet-based identity authentication, leveraging `tag:ci` for the GitHub runner and `tag:server` for the self-hosted HP Pro Tower.
- **Docker Orchestration:** Verified the automatic pulling of code, rebuilding of containers, and database schema synchronization (`npm run db:push`) via the private tunnel.
- **Infrastructure Documentation:** Created `DEPLOYMENT_PACKAGE/CI_CD_GUIDE.md` with the finalized Tailscale ACL JSON structure and tagging instructions.

#### **Session 154: High Availability & Sovereign Storage Overhaul (June 10, 2026)**
- **Sovereign Storage Architecture:** Engineered a high-performance local storage system for the self-hosted environment. Transitioned from database-bloating Base64 storage to a robust filesystem-backed vault (`/app/public/uploads`).
- **High-Performance Asset Serving:** Optimized Nginx configuration to serve user assets directly via a dedicated `/uploads/` location block, bypassing Node.js overhead and resolving critical image loading latency.
- **Security Hardening:** Hardened the asset serving pipeline with mandatory Nginx security headers, strictly enforced directory traversal guards (`path.resolve`) across all proxy handlers, standardized the `/app/public/uploads` local path fallback, and prevented SVG script-execution via forced downloads.
- **Development Asset Routing:** Engineered dynamic asset proxy routing (`/api/assets/view/...`) and Next.js rewrites to ensure self-hosted images and static manifest assets (`assets/ku-logo.png`) load correctly in local Tailscale/development environments without Nginx dependencies.
- **Unified Storage Provider:** Developed a strategic `StorageProvider` abstraction, enabling seamless switching between Cloudinary and Local VPS storage via environment variables (`NEXT_PUBLIC_STORAGE_TYPE`).
- **Robustness & Integrity:** Implemented atomic "track-and-cleanup" logic for orphaned assets during upload failures and upgraded `StudentService` with advanced magic-byte detection for multi-format image support (PNG, JPEG, GIF, WebP).
- **Test Suite Verification:** Updated Vitest mocks to properly intercept the new `StorageProvider` factory, restoring 100% pass rates (84/84 tests) for `StudentService` CI/CD validation.
- **Data Integrity & Migration:** Created a surgical migration utility (`src/db/migrate-images-to-local.js`) to offload existing Base64 images from the database to the filesystem, restoring system performance.
- **Engagement Infrastructure:** Hardened the "Always Active" experience by integrating Uptime Kuma monitoring with institutional health checks and refining the PWA's aggressive caching and zombie-connection recovery.

#### **Session 153: Deployment Sovereignty, Storage Unification & Asset Restoration (June 10, 2026)**
- **Deployment Documentation:** Engineered the `MASTER_DEPLOYMENT_GUIDE.md` for zero-ambiguity local self-hosting execution.
- **Storage Architecture Refactor:** Eliminated the dual public/private storage split. Unified all asset storage into a single robust vault (`/var/www/kucet-storage/public`), drastically simplifying permissions and volume management.
- **Network Resilience:** Resolved a critical startup crash by removing Nginx's binding to Port 443, eliminating a direct conflict with Tailscale's local HTTPS funnel. Cloudflare Tunnel securely handles external HTTPS on Port 80.
- **Asset Migration & Organization:** Successfully uploaded a full 68MB local backup (`kucet_full.zip`) via SCP. Extracted and systematically mapped static public assets to the vault root while mapping all user-uploaded data (`admission_drafts`, `students`, `clerks`, etc.) into a dedicated `kucet/` subdirectory to maintain Cloudinary path parity.
- **Knowledge Persistence:** Centralized all self-hosting context into `GEMINI.md` as the primary architectural reference.

#### **Session 152: Global Image Standardization (June 9, 2026)**
- **Image Upload Hardening:** Standardized all image upload size limits to strictly **less than 2MB** project-wide. 
- **Institutional Alignment:** Synchronized limits across the Admission Portal, Clerk Student Management, and Developer Bug Reporting modules to ensure infrastructure cost-efficiency and performance.
- **UX & Validation:** Updated client-side validation logic and UI hints to provide immediate feedback on the new 2MB threshold, reducing server-side rejection overhead.

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
- **Minority Logic:** Aligned scholarship engine with GO Rt No. 63 for full reimbursement for Minority/SC/ST students.
- **Roll Number Excellence:** Hardened generation logic for Lateral Entry (TG ECET) batch continuity.

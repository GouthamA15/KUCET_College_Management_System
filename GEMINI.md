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

#### **Session 154: High Availability & Sovereign Storage Overhaul (June 10, 2026)**
- **Sovereign Storage Architecture:** Engineered a high-performance local storage system for the self-hosted environment. Transitioned from database-bloating Base64 storage to a robust filesystem-backed vault (`/app/public/uploads`).
- **High-Performance Asset Serving:** Optimized Nginx configuration to serve user assets directly via a dedicated `/uploads/` location block, bypassing Node.js overhead and resolving critical image loading latency.
- **Security Hardening:** Hardened the asset serving pipeline with mandatory Nginx security headers, directory traversal protection in `LocalStorageProvider`, and SVG script-execution prevention via forced downloads.
- **Unified Storage Provider:** Developed a strategic `StorageProvider` abstraction, enabling seamless switching between Cloudinary and Local VPS storage via environment variables (`NEXT_PUBLIC_STORAGE_TYPE`).
- **Robustness & Integrity:** Implemented atomic "track-and-cleanup" logic for orphaned assets during upload failures and upgraded `StudentService` with advanced magic-byte detection for multi-format image support (PNG, JPEG, GIF, WebP).
- **Data Integrity & Migration:** Created a surgical migration utility (`src/db/migrate-images-to-local.js`) to offload existing Base64 images from the database to the filesystem, restoring system performance.
- **Engagement Infrastructure:** Hardened the "Always Active" experience by integrating Uptime Kuma monitoring with institutional health checks and refining the PWA's aggressive caching and zombie-connection recovery.

#### **Session 153: Deployment Sovereignty, Storage Unification & Asset Restoration (June 10, 2026)**
- **Deployment Documentation:** Engineered the `MASTER_DEPLOYMENT_GUIDE.md` for zero-ambiguity local self-hosting execution.
- **Storage Architecture Refactor:** Eliminated the dual public/private storage split. Unified all asset storage into a single robust vault (`/var/www/kucet-storage/public`), drastically simplifying permissions and volume management.
- **Network Resilience:** Resolved a critical startup crash by removing Nginx's binding to Port 443, eliminating a direct conflict with Tailscale's local HTTPS funnel. Cloudflare Tunnel securely handles external HTTPS on Port 80.
- **Asset Migration & Organization:** Successfully uploaded a full 68MB local backup (`kucet_full.zip`) via SCP. Extracted and systematically mapped static public assets to the vault root while mapping all user-uploaded data (`admission_drafts`, `students`, `clerks`, etc.) into a dedicated `kucet/` subdirectory to maintain Cloudinary path parity.
- **Knowledge Persistence:** Centralized all self-hosting context into `GEMINI.md` as the primary architectural reference.

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
- **Minority Logic:** Aligned scholarship engine with GO Rt No. 63 for full reimbursement for Minority/SC/ST students.
- **Roll Number Excellence:** Hardened generation logic for Lateral Entry (TG ECET) batch continuity.

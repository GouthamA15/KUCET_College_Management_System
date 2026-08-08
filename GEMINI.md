# KUCET College Management System - Technical Documentation

**Last Updated:** August 8, 2026 (Session 188)

## 1. Project Overview
A robust, production-ready web application built with **Next.js** for managing the complete academic lifecycle at KUCET. The system supports **Super Admin**, **HOD**, **Clerk/Faculty**, and **Student** roles.

### Core Capabilities:
- **Departmental Management:** Multi-semester timetable orchestration and faculty workload tracking.
- **Real-Time Orchestration:** Instant schedule and activity synchronization via Supabase Broadcast.
- **Admissions & Records:** Multi-stage admission pipeline and comprehensive student registry.
- **Attendance Tracking:** GPS-based, proxy-free attendance with fingerprinting and React 19 optimistic updates.
- **Internal Marks:** Entry with validation and departmental pattern recommendations.
- **Financial & Certificates:** Scholarship tracking, fee management, and automated digital certificate generation.
- **Academic Data Archival & Restoration:** Production-grade long-term archival engine for historical student registries, closed semester attendance, evaluation marks, payment receipts, and media storage assets with safe zero-data-loss restoration capabilities.
- **Enterprise Core Systems:** Centralized Domain Event Bus, Tagged Cache-Aside Redis layer, Async QStash Background Workers, PWA Offline capability, Web Push Notifications, Fine-grained RBAC, Observability & Tracing, Multi-Provider Failover, and Automated Backups with Retention Pruning.
- **Production Deployment & Operations:** Multi-container Docker Compose packaging, zero-downtime Linux VPS deployment automation, automated rollback, disaster recovery procedures, real-time infrastructure monitoring, and full diagnostic operational health probes.

## 2. Technical Stack
- **Framework:** Next.js 16 (App Router), React 19, Tailwind CSS 4.
- **Database:** TiDB Cloud (MySQL) with **Drizzle ORM** (Modular DDD Domain Schemas).
- **Auth:** JWT (HTTP-only) via `jose`, Google OAuth (`next-auth`).
- **Real-Time:** Supabase Realtime (Broadcast) & Redis Pub/Sub (`ioredis`).
- **Security:** AES-256-GCM encryption for PII, SHA-256 blind indexing, Fine-Grained Permission RBAC.
- **Infrastructure:** Sentry (Monitoring), Cloudinary/S3/Local (Failover Storage), Upstash (Rate Limiting/QStash Queue/Redis Cache), Docker & Docker Compose (Production packaging), PM2 (Process Manager).
- **Tooling:** Zod (Validation), Vitest & Playwright (Unit & E2E Testing), Pino (Logging).

## 3. Core Architectural Concepts

### A. Database & Type Safety
- **Drizzle ORM:** Modular domain schemas located in `src/db/schema/` (`identity.js`, `academic.js`, `registry.js`, `attendance.js`, `finance.js`, `security.js`, `operations.js`, `archive.js`, `index.js`). Barrel re-export in `src/db/schema.js` ensures 100% backwards compatibility. Uses versioned migrations (`drizzle-kit`).
  - **Safe Database Updates (Data Loss Prevention):** NEVER use `npm run db:push` to update the database schema, as it may drop tables or columns and cause data loss. ALWAYS use the safe migration workflow:
    1. Update domain schemas in `src/db/schema/`.
    2. Run `npm run db:generate` to generate a `.sql` migration file in `drizzle/`.
    3. Manually review the `.sql` file to ensure no unintended `DROP` statements exist (e.g., if renaming a column, change `DROP` + `ADD` to `RENAME COLUMN`).
    4. Run `npm run db:migrate` to safely apply the changes.
- **Zero-Trust Validation:** Strict Zod schema enforcement on all API boundaries via a unified `wrapHandler`.

### B. Service & Provider Layer
- **Domain-Oriented Service Layer:** Business logic organized into domain subdirectories under `src/services/`:
  - `identity/`: `DeviceService.js`, `StudentService.js`, `StudentCertificateService.js`, `StudentProfileService.js`
  - `academic/`: `FacultyService.js`
  - `finance/`: `FinanceService.js`, `ScholarshipService.js`, `IdempotencyService.js`
  - `archive/`: `ArchiveService.js`, `ArchiveMediaService.js`, `ArchiveRestoreService.js`, `OrphanMediaService.js`, `BackupService.js`, `DisasterRecoveryService.js`
  - `security/`: `SecurityService.js`, `ValidationService.js`, `PushNotificationService.js`
  - `shared/`: `HealthService.js`
  - Barrel export in `src/services/index.js` and root re-exports guarantee backwards compatibility for all import paths.
- **Provider Pattern & Failover Strategy:** Strategy pattern for Email, Storage (S3 -> Cloudinary -> Local), and Realtime providers with automated failover wrappers enabling zero downtime during provider outages.

### C. Security & Robustness
- **Integrity Guard:** SHA-256 fingerprinting for payment evidence to detect fraud/reuse.
- **Circuit Breakers:** Fail-fast utility for external services to prevent cascading hangs.
- **Financial Idempotency:** Registry-backed guards ensuring transactions process exactly once.
- **Session Orchestration:** Real-time remote revocation and device-heuristic tracking.
- **Baseline API Middleware Protection:** Middleware-level defense-in-depth role authorization enforcing access controls on `/api/admin/*` and `/api/clerk/*` routes.
- **Safe Utilities & Robust Parsing:** Centralized `safeJsonParse()` utility preventing runtime exceptions from corrupted or malformed JSON payloads and storage keys.
- **Dual-Mode Database Restoration:** Production backup restoration supporting native `mysql` CLI execution with automatic Drizzle SQL statement batch execution fallback.
- **Docker Containerization:** Multi-stage production `Dockerfile` with Node 20 alpine runner, Next.js `standalone` mode, non-root user (`nextjs:nodejs`), `mysql-client` toolchain, and health monitoring endpoint (`/api/health`).

### D. Time Management
- **Authoritative Clock:** `src/lib/clock.js` (`getNow()`) ensures IST consistency and supports "Time Machine" testing.

## 4. Database Schema Summary
- **Identity:** `students`, `clerks`, `principal`, `user_sessions`, `otp_codes`.
- **Academic:** `college_info`, `academic_calendar`, `syllabus_subjects`, `syllabus_structure`.
- **Registry:** `student_personal_details`, `student_academic_background`, `student_admission_drafts`.
- **Operations:** `student_attendance`, `student_marks`, `branch_timetable`, `faculty_subject_assignments`.
- **Finance:** `scholarship_sanctions`, `student_payments`, `idempotency_keys`.
- **Archive:** `archive_students`, `archive_student_personal_details`, `archive_student_academic_background`, `archive_student_attendance`, `archive_attendance_sessions`, `archive_student_marks`, `archive_student_payments`, `archive_operations_log`, `archive_retention_policies`.
- **Security & Notifications:** `security_events`, `security_notifications`, `rate_limits`, `audit_logs`, `push_subscriptions`, `notification_preferences`.

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

# KUCET College Management System - Technical Documentation

**Last Updated:** August 8, 2026 (Session 188)

## 1. Project Overview
A robust, production-ready web application built with **Next.js** for managing the complete academic lifecycle at KUCET. The system supports **Super Admin**, **HOD**, **Clerk/Faculty**, and **Student** roles.

### Core Capabilities:
- **Departmental Management:** Multi-semester timetable orchestration and faculty workload tracking.
- **Real-Time Orchestration:** Instant schedule and activity synchronization via Supabase Broadcast.
- **Admissions & Records:** Multi-stage admission pipeline and comprehensive student registry.
- **Attendance Tracking:** GPS-based, proxy-free attendance with fingerprinting and React 19 optimistic updates.
- **Internal Marks:** Entry with validation and departmental pattern recommendations.
- **Financial & Certificates:** Scholarship tracking, fee management, and automated digital certificate generation.
- **Academic Data Archival & Restoration:** Production-grade long-term archival engine for historical student registries, closed semester attendance, evaluation marks, payment receipts, and media storage assets with safe zero-data-loss restoration capabilities.
- **Enterprise Core Systems:** Centralized Domain Event Bus, Tagged Cache-Aside Redis layer, Async QStash Background Workers, PWA Offline capability, Web Push Notifications, Fine-grained RBAC, Observability & Tracing, Multi-Provider Failover, and Automated Backups with Retention Pruning.
- **Production Deployment & Operations:** Multi-container Docker Compose packaging, zero-downtime Linux VPS deployment automation, automated rollback, disaster recovery procedures, real-time infrastructure monitoring, and full diagnostic operational health probes.

## 2. Technical Stack
- **Framework:** Next.js 16 (App Router), React 19, Tailwind CSS 4.
- **Database:** TiDB Cloud (MySQL) with **Drizzle ORM** (Modular DDD Domain Schemas).
- **Auth:** JWT (HTTP-only) via `jose`, Google OAuth (`next-auth`).
- **Real-Time:** Supabase Realtime (Broadcast) & Redis Pub/Sub (`ioredis`).
- **Security:** AES-256-GCM encryption for PII, SHA-256 blind indexing, Fine-Grained Permission RBAC.
- **Infrastructure:** Sentry (Monitoring), Cloudinary/S3/Local (Failover Storage), Upstash (Rate Limiting/QStash Queue/Redis Cache), Docker & Docker Compose (Production packaging), PM2 (Process Manager).
- **Tooling:** Zod (Validation), Vitest & Playwright (Unit & E2E Testing), Pino (Logging).

## 3. Core Architectural Concepts

### A. Database & Type Safety
- **Drizzle ORM:** Modular domain schemas located in `src/db/schema/` (`identity.js`, `academic.js`, `registry.js`, `attendance.js`, `finance.js`, `security.js`, `operations.js`, `archive.js`, `index.js`). Barrel re-export in `src/db/schema.js` ensures 100% backwards compatibility. Uses versioned migrations (`drizzle-kit`).
  - **Safe Database Updates (Data Loss Prevention):** NEVER use `npm run db:push` to update the database schema, as it may drop tables or columns and cause data loss. ALWAYS use the safe migration workflow:
    1. Update domain schemas in `src/db/schema/`.
    2. Run `npm run db:generate` to generate a `.sql` migration file in `drizzle/`.
    3. Manually review the `.sql` file to ensure no unintended `DROP` statements exist (e.g., if renaming a column, change `DROP` + `ADD` to `RENAME COLUMN`).
    4. Run `npm run db:migrate` to safely apply the changes.
- **Zero-Trust Validation:** Strict Zod schema enforcement on all API boundaries via a unified `wrapHandler`.

### B. Service & Provider Layer
- **Domain-Oriented Service Layer:** Business logic organized into domain subdirectories under `src/services/`:
  - `identity/`: `DeviceService.js`, `StudentService.js`, `StudentCertificateService.js`, `StudentProfileService.js`
  - `academic/`: `FacultyService.js`
  - `finance/`: `FinanceService.js`, `ScholarshipService.js`, `IdempotencyService.js`
  - `archive/`: `ArchiveService.js`, `ArchiveMediaService.js`, `ArchiveRestoreService.js`, `OrphanMediaService.js`, `BackupService.js`, `DisasterRecoveryService.js`
  - `security/`: `SecurityService.js`, `ValidationService.js`, `PushNotificationService.js`
  - `shared/`: `HealthService.js`
  - Barrel export in `src/services/index.js` and root re-exports guarantee backwards compatibility for all import paths.
- **Provider Pattern & Failover Strategy:** Strategy pattern for Email, Storage (S3 -> Cloudinary -> Local), and Realtime providers with automated failover wrappers enabling zero downtime during provider outages.

### C. Security & Robustness
- **Integrity Guard:** SHA-256 fingerprinting for payment evidence to detect fraud/reuse.
- **Circuit Breakers:** Fail-fast utility for external services to prevent cascading hangs.
- **Financial Idempotency:** Registry-backed guards ensuring transactions process exactly once.
- **Session Orchestration:** Real-time remote revocation and device-heuristic tracking.
- **Baseline API Middleware Protection:** Middleware-level defense-in-depth role authorization enforcing access controls on `/api/admin/*` and `/api/clerk/*` routes.
- **Safe Utilities & Robust Parsing:** Centralized `safeJsonParse()` utility preventing runtime exceptions from corrupted or malformed JSON payloads and storage keys.
- **Dual-Mode Database Restoration:** Production backup restoration supporting native `mysql` CLI execution with automatic Drizzle SQL statement batch execution fallback.
- **Docker Containerization:** Multi-stage production `Dockerfile` with Node 20 alpine runner, Next.js `standalone` mode, non-root user (`nextjs:nodejs`), `mysql-client` toolchain, and health monitoring endpoint (`/api/health`).

### D. Time Management
- **Authoritative Clock:** `src/lib/clock.js` (`getNow()`) ensures IST consistency and supports "Time Machine" testing.

## 4. Database Schema Summary
- **Identity:** `students`, `clerks`, `principal`, `user_sessions`, `otp_codes`.
- **Academic:** `college_info`, `academic_calendar`, `syllabus_subjects`, `syllabus_structure`.
- **Registry:** `student_personal_details`, `student_academic_background`, `student_admission_drafts`.
- **Operations:** `student_attendance`, `student_marks`, `branch_timetable`, `faculty_subject_assignments`.
- **Finance:** `scholarship_sanctions`, `student_payments`, `idempotency_keys`.
- **Archive:** `archive_students`, `archive_student_personal_details`, `archive_student_academic_background`, `archive_student_attendance`, `archive_attendance_sessions`, `archive_student_marks`, `archive_student_payments`, `archive_operations_log`, `archive_retention_policies`.
- **Security & Notifications:** `security_events`, `security_notifications`, `rate_limits`, `audit_logs`, `push_subscriptions`, `notification_preferences`.

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

### **E. Academic Archive & Data Restoration Engine**
- **Data Lifecycle Management:** Automated and manual archival of closed semester attendance, internal marks, payment transaction receipts, and graduated student profiles into optimized `archive_*` tables.
- **Cloud Media Asset Archival:** Moves profile photos, signatures, and payment verification screenshots from operational storage paths (`uploads/`) to long-term storage namespaces (`archive/`) with multi-provider strategy support (S3/R2, Local, Cloudinary).
- **Zero-Data-Loss Restoration:** Granular search, profile preview, and 1-click restore functionality allowing Super Admin to reactivate archived student profiles and academic logs back to operational database without manual SQL queries.
- **Audit Log & Retention Engine:** Immutable tracking of every archival execution with storage size metrics, elapsed duration, and configurable retention policy thresholds.

## 6. Recent Activity Log (May - August 2026)

#### **Session 191: GitHub Actions Runner Permissions Fix (August 8, 2026)**
- **Deployment Runner Unblocked:**
  - Diagnosed `Operation not permitted` during `deploy.sh` execution. Identified that the GitHub Actions runner was incorrectly executing as `kucet-dev`, but the `/var/www/kucet-cms` deployment directory is intentionally owned by `deployer` (the dedicated auto-deployment user).
  - Clarified architecture: `kucet-dev` is exclusively the developer user, while `deployer` orchestrates CI/CD. The host deployment directories (`/var/www/kucet-cms` and `/var/log/kucet`) must remain owned by `deployer:deployer`, and the GitHub runner must be re-configured to run as `deployer`.
- **Workflow Resilience Update:**
  - Removed brittle `chmod +x` commands from `.github/workflows/deploy.yml` and explicitly executed scripts via `bash` to prevent permission-related pipeline failures.
  - Updated `setup-runner-service.sh` to enforce `deployer` ownership and paths (`/home/deployer/actions-runner`) instead of `kucet-dev`.

#### **Session 190: Storage Permission & Env Variables Fix (August 8, 2026)**
- **Host Permission Issue Fixed:**
  - Diagnosed `EACCES: permission denied` when Next.js app running inside the container as `nextjs` (UID 1001) attempted to write to the bind-mounted host directory `/var/www/kucet-storage/public` owned by `kucet-dev` (UID 1000) with `755` permissions. Fixed by running `chmod -R 777` on the host directory.
- **Architectural Cleanup of Env Variables:**
  - Removed hardcoded local fallback paths (`/var/www/kucet-storage/public` and `/app/public/uploads`) inside `LocalStorageProvider.js`. It now relies explicitly on `process.env.LOCAL_STORAGE_PATH`.
  - Updated `LOCAL_STORAGE_PATH` in `.env.production` and templates to correctly point to the path from the container's perspective (`/app/public/uploads`) instead of the host's perspective, eliminating any path resolution ambiguities.

#### **Session 189: Storage Provider Path Resolution Fix (August 8, 2026)**
- **Root Cause Analysis for Local Image Serving (404 Errors):**
  - Diagnosed asset delivery failures in the Next.js `standalone` Docker container. Identified that `process.cwd()` resolves to `/app` inside the container, causing `LocalStorageProvider` and the `assets/view` proxy to search in `/app/public` rather than the mounted host volume `/var/www/kucet-storage/public`.
  - Identified hardcoded fallback paths referencing the incorrect `/uploads` directory instead of the `/public` directory across multiple routes.
- **Centralized Storage Resolution:**
  - Refactored `getLocalStorageBasePath()` in `src/lib/providers/storage/LocalStorageProvider.js` to be the single source of truth for the local storage root.
  - Prioritized `LOCAL_STORAGE_PATH` env var with a safe fallback to `/var/www/kucet-storage/public`, eliminating the `process.cwd()` Docker trap completely.
- **API Route & Service Refactoring:**
  - Replaced duplicated, flawed inline path resolution logic with imports of `getLocalStorageBasePath()` across the codebase:
    - Asset Proxy (`src/app/api/assets/view/[...path]/route.js`)
    - Student Profile Images (`src/app/api/student/image/[rollno]/route.js`)
    - Request Payment Screenshots (`src/app/api/student/requests/image/[request_id]/route.js`)
    - Storage Admin Explorer (`src/app/api/admin/infrastructure/storage/route.js`)
    - PDF Download Generator (`src/app/api/student/requests/download/[request_id]/route.js`)
    - Orphan Media Cleanup (`src/services/archive/OrphanMediaService.js`)

#### **Session 188: Autonomous & Self-Healing Deployment Infrastructure (August 8, 2026)**
- **Critical Gap Resolved — GitHub Runner Persistence:**
  - Identified that the GitHub Actions self-hosted runner was started manually via `./run.sh`, dying on every server reboot and silently failing all CI/CD deployments.
  - Created `setup-runner-service.sh` (`DEPLOYMENT_PACKAGE/SCRIPTS/setup-runner-service.sh`) that gracefully stops any running `./run.sh` process, calls the runner's built-in `./svc.sh install` to register it as a systemd unit, enables it with `systemctl enable`, and enables `docker.service` + `containerd.service` for auto-start on reboot.
- **Production Deploy Script (`deploy.sh`):**
  - Created `DEPLOYMENT_PACKAGE/SCRIPTS/deploy.sh` as the canonical deploy entry point called by GitHub Actions. Performs: environment load from `.env.production`, `git pull`, `DB_HOST=127.0.0.1 npm run db:migrate`, Docker build + restart of `kucet-cms-app` only (preserving DB/Redis), network alias reconnection, Nginx config validation (`nginx -t`) before reload, and post-deploy health check with automatic rollback on failure. Writes timestamped log to `/var/log/kucet/deploy_<timestamp>.log` and appends a JSON record to `/var/log/kucet/deployments.json`.
- **Comprehensive Health Check (`health-check.sh`):**
  - Created `DEPLOYMENT_PACKAGE/SCRIPTS/health-check.sh` performing 13-point PASS/FAIL validation: all 5 Docker container states, HTTP 200 from `/api/health`, MySQL `mysqladmin ping`, Redis `PONG`, Nginx `nginx -t` config validity, GitHub runner `systemctl is-active`, storage directory writable check, disk space (>10GB), and RAM usage. Supports `--json` flag for programmatic consumption.
- **Full Rollback Rewrite (`rollback.sh`):**
  - Rewrote `DEPLOYMENT_PACKAGE/SCRIPTS/rollback.sh` to be Docker-aware. Performs `git checkout TARGET_COMMIT`, rebuilds and restarts only the app container, re-runs health check, exits with code 2 on double-failure (distinguishable from normal exit 1), sends webhook notification via `BACKUP_ALERT_WEBHOOK_URL` on completion.
- **Self-Healing Watchdog (`monitor.sh`):**
  - Created `DEPLOYMENT_PACKAGE/SCRIPTS/monitor.sh` (cron every 5 minutes). Checks all 5 containers and restarts via `docker compose up -d <service>` if stopped. Checks GitHub runner systemd unit and restarts if inactive. Tracks `/api/health` failures in `/tmp/kucet_health_failures` counter — triggers `rollback.sh` to last known-good commit (from `deployments.json`) after 3 consecutive failures. Sends webhook alerts on any auto-recovery. Rotates monitor.log if >50MB.
- **Boot Recovery Script (`boot-recovery.sh`):**
  - Created `DEPLOYMENT_PACKAGE/SCRIPTS/boot-recovery.sh` that runs on every reboot via `@reboot` cron. Waits up to 120s for Docker daemon, runs `docker compose up -d` to bring all containers back, polls `/api/health` for 90s, verifies runner service, and logs to `/var/log/kucet/boot-recovery.log`.
- **One-Time Setup Orchestration:**
  - Created `setup-runner-service.sh`, `setup-logrotate.sh`, `setup-cron.sh`, and master `setup-all.sh` orchestrator. Running `sudo bash DEPLOYMENT_PACKAGE/SCRIPTS/setup-all.sh` once on the VPS configures the complete autonomous stack end-to-end.
- **Centralized Deployment Logging (`/var/log/kucet/`):**
  - All scripts log to `/var/log/kucet/`. Created `DEPLOYMENT_PACKAGE/CONFIGS/logrotate/kucet-cms` and `setup-logrotate.sh` installing it to `/etc/logrotate.d/kucet-cms` (daily rotation, 30-day retention, compressed, `copytruncate`).
- **Updated GitHub Actions Workflow (`deploy.yml`):**
  - Replaced minimal `deploy.yml` with production-grade workflow: 10-minute job timeout, `concurrency: production-deploy` lock preventing parallel deploys, calls `deploy.sh` with `--commit ${{ github.sha }}`, explicit emergency rollback step using `github.event.before` on failure, always-uploads deploy log as GitHub Actions artifact (30-day retention).
- **Updated `DEPLOYMENT_PACKAGE/MASTER_DEPLOYMENT_GUIDE.md`:**
  - Added Phase 14 (Autonomous Deployment Setup) documenting the one-time setup command, script inventory table, verification procedure, and boot recovery test steps.

#### **Session 187: Production Deployment Automation & Operational Excellence (`38a1bb4` & `4829dbc`) (August 7, 2026)**
- **Deployment Automation Suite (`scripts/deployment/`):**
  - Created `deploy-vps.sh` (`scripts/deployment/deploy-vps.sh`) providing environment validation, dependency installation, safe database migration (`npm run db:migrate`), zero-downtime application process reload via PM2/Docker, post-deployment health verification (`/api/health`), and automatic rollback to previous commit on failure.
  - Created `rollback.sh` (`scripts/deployment/rollback.sh`) for rapid emergency rollback to any commit hash.
  - Created `backup-restore.sh` (`scripts/deployment/backup-restore.sh`) for database backup and snapshot restoration.
- **Multi-Container Docker Packaging (`docker-compose.yml`):**
  - Created production `docker-compose.yml` orchestrating Next.js Standalone runner (`kucet-cms-app`), MySQL 8.0 (`kucet-cms-db`), and Redis 7 Alpine (`kucet-cms-redis`) with automated container healthcheck probes (`/api/health`).
- **Real-Time Infrastructure Monitoring (`/api/admin/infrastructure/monitoring`):**
  - Built secure admin monitoring endpoint `src/app/api/admin/infrastructure/monitoring/route.js` exposing Node.js RSS/Heap memory consumption, process uptime, active user session count (`user_sessions`), active student registry count (`students`), database connection status, and diagnostic health report.
- **Operational Health Diagnostics (`/api/health` & `HealthService.js`):**
  - Enhanced `HealthService.js` (`src/services/shared/HealthService.js`) and public probe `/api/health` to return component-level diagnostics across Database (SQL query latency), Redis (PING response), Storage Provider, Email API credentials, Push Notifications, QStash Queue, and Scheduled Backups. Covered by Vitest unit tests in `tests/unit/services/OperationalExcellence.test.js`.
- **Automated Disaster Recovery Engine (`DisasterRecoveryService.js` & `/api/admin/infrastructure/disaster-recovery`):**
  - Created `DisasterRecoveryService.js` (`src/services/archive/DisasterRecoveryService.js`) and REST API route `/api/admin/infrastructure/disaster-recovery/route.js` implementing automated database table integrity verification (`verifyDatabaseIntegrity`), tag-based domain cache rebuilding (`rebuildDomainCaches`), and comprehensive disaster recovery report generation. Covered by Vitest unit tests.
- **Storage Audit & Orphan Media Cleanup API (`/api/admin/infrastructure/storage/audit`):**
  - Created API route `src/app/api/admin/infrastructure/storage/audit/route.js` wrapping `OrphanMediaService.scanOrphanMedia` supporting dry-run inspection (GET/POST) and real file cleanup execution (POST `dryRun: false`).
- **Performance Benchmarking Suite (`scripts/benchmark-system.js`):**
  - Created system benchmarking CLI script `scripts/benchmark-system.js` measuring health diagnostics latency, 1,000 RBAC evaluation times, and Cache-Aside retrieval speed.
- **Comprehensive Operational Documentation (`OPERATIONAL_RUNBOOK.md`):**
  - Authored authoritative `OPERATIONAL_RUNBOOK.md` detailing production deployment instructions, emergency rollback workflows, disaster recovery procedures, health check references, and system maintenance checklists.
- **E2E Test Suite Expansion (`tests/enterprise-features.spec.js`):**
  - Created Playwright E2E test suite `tests/enterprise-features.spec.js` verifying Web App manifest (`manifest.json`), offline fallback route (`/offline`), backup schedule authorization guards, storage audit authorization guards, and push subscription authorization guards.
- **System Verification & Git Push:**
  - ESLint check: `npm run lint` passed cleanly with 0 errors.
  - Vitest Unit suite: 194 unit tests passed cleanly across 26 test files (`npm test -- --run`).
  - Playwright E2E suite: 23 E2E tests passed cleanly across 7 spec files (`npx playwright test`).
  - Production Build: `npm run build` compiled successfully (0 build errors).
  - Git Push: Pushed to `origin/testvanilla` (`4829dbc`).

#### **Session 186: Final Enterprise Hardening & Completion Sprint (August 7, 2026)**
- **Domain Event Bus (`src/lib/events/EventBus.js`):**
  - Built centralized, non-blocking asynchronous Domain Event Bus (`EventBus.publish`, `EventBus.subscribe`) with analytics metrics tracking (`getAnalytics()`).
  - Defined standard domain events: `ATTENDANCE_SUBMITTED`, `TOPIC_UPDATED`, `MARKS_PUBLISHED`, `FEE_PAID`, `STUDENT_REGISTERED`, `ARCHIVE_COMPLETED`, `STUDENT_RESTORED`, `CERTIFICATE_ISSUED`.
  - Registered built-in audit logging and tag-based cache invalidation subscribers. Covered by Vitest unit tests (`tests/unit/events/EventBus.test.js`).
- **Redis Cache-Aside Layer & Tagged Invalidation (`src/lib/cache.js`):**
  - Implemented `cacheAside(key, fetcher, { ttl, tags })` helper with in-memory fallback for local environments and Upstash Redis production mode.
  - Built key and tag-based invalidation (`invalidateKey`, `invalidateTag`) and domain key constants (`CACHE_KEYS`) for College Config, Academic Calendar, Timetable, Department Config, Subject Structure, Fee Structures, and System Config. Covered by Vitest unit tests (`tests/unit/lib/cache.test.js`).
- **Background Job Queue Expansion (`src/lib/queue.js` & QStash Workers):**
  - Expanded background queue helpers (`Queue.enqueueArchiveJob`, `Queue.enqueueNotificationDispatch`, `Queue.enqueueReportGeneration`, `Queue.enqueuePdfGeneration`).
  - Built QStash webhook worker routes: `/api/webhooks/qstash/archive-job`, `/api/webhooks/qstash/notification-dispatch`, `/api/webhooks/qstash/report-generation`, and `/api/webhooks/qstash/generate-pdf`.
- **Progressive Web App (PWA) Support:**
  - Authored web app manifest (`public/manifest.json`), client registration component (`src/components/PwaRegister.js`), and offline fallback route (`/offline`).
  - Created Service Worker (`public/sw.js`) implementing Stale-While-Revalidate caching for Digital ID Card (`/student/requests/id-card`), Fee Receipts (`/student/finances`), and Weekly Timetable (`/student/academics`), while explicitly bypassing sensitive authentication and payment submit endpoints.
- **Web Push Notifications System:**
  - Added `push_subscriptions` and `notification_preferences` tables to `src/db/schema/security.js`. Generated migration `drizzle/0010_tan_cerebro.sql` and applied safely via `npm run db:migrate`.
  - Built `PushNotificationService.js` (`src/services/security/PushNotificationService.js`) and REST API endpoints `/api/notifications/subscribe` and `/api/notifications/preferences`. Covered by Vitest unit tests (`tests/unit/services/PushNotificationService.test.js`).
- **Enterprise RBAC Permission Authorization (`src/lib/rbac.js`):**
  - Replaced legacy simple role string checks with fine-grained permission matrix (`PERMISSIONS` dictionary: `ATTENDANCE_MARK`, `ATTENDANCE_EDIT`, `MARK_ENTRY`, `MARK_APPROVE`, `FEE_VERIFY`, `FEE_EDIT`, `CERTIFICATE_APPROVE`, `ARCHIVE_RUN`, `ARCHIVE_RESTORE`, `REPORT_EXPORT`).
  - Built evaluation helpers (`hasPermission`, `hasAnyPermission`, `hasAllPermissions`). Covered by Vitest unit tests (`tests/unit/lib/rbac.test.js`).
- **Enterprise Observability & Performance Tracing (`src/lib/observability.js`):**
  - Created `observability.js` integrating request ID propagation (`x-request-id`), Sentry capture fallback, slow query logging (`logSlowQuery`), performance metrics tracing (`withPerformanceTracing`), and error correlation token generation (`createErrorCorrelationId`).
  - Updated Next.js proxy middleware (`src/proxy.js`) to generate and forward `x-request-id` headers on all incoming and outgoing requests. Covered by Vitest unit tests (`tests/unit/lib/observability.test.js`).
- **Multi-Provider Storage Failover (`src/lib/providers/storage/FailoverStorageProvider.js`):**
  - Implemented `FailoverStorageProvider` implementing an ordered fallback chain (S3 -> Cloudinary -> Local Disk).
  - Updated `src/lib/providers/storage/factory.js` to return `FailoverStorageProvider` by default for zero-downtime storage operations. Covered by Vitest unit tests (`tests/unit/lib/providers/FailoverStorageProvider.test.js`).
- **Automated Scheduled Backups & Retention Pruning (`src/services/archive/BackupService.js`):**
  - Created `BackupService.js` supporting automated snapshot orchestration across DB, Archive, and Media assets with SHA-256 checksum verification, structural integrity checks, and retention pruning (30-day default).
  - Built API route `/api/admin/infrastructure/backups/schedule`. Covered by Vitest unit tests (`tests/unit/services/BackupService.test.js`).
- **Enterprise WCAG 2.1 AA Accessibility:**
  - Integrated keyboard navigation skip link (`Skip to main content`), `main-content` landmark wrapper, and `PwaRegister` into `src/app/layout.js`.
- **System Verification & Production Build:**
  - ESLint checks: `npm run lint` passed with 0 errors.
  - Vitest Unit suite: 192 unit tests passed cleanly across 25 test files (`npm test -- --run`).
  - Playwright E2E suite: 18 E2E tests passed cleanly across all spec files (`npx playwright test`).
  - Production Build: `npm run build` compiled successfully (0 build errors).

#### **Session 185: Security Hardening, System Resilience, Query Pagination & Bulk Offline Attendance Sync (`02c120f` to `6ba15f3`) (August 7, 2026)**
- **Legacy Archive Endpoint Deprecation (`02c120f`):**
  - Deprecated legacy data archiving route `/api/admin/infrastructure/archive-data/route.js` in favor of the newly implemented DDD Archive Management System (`/api/admin/archive`).
  - Added HTTP `410 Gone` handlers for both GET and POST requests, guiding callers to `/api/admin/archive` and `/api/admin/archive/run`.
  - Added `"test": "vitest run"` script alias to `package.json` for standard test execution CLI consistency.
- **Safe JSON Parsing Utility & App-Wide Resilience (`797b01c`):**
  - Engineered centralized `safeJsonParse(value, fallback)` helper in `src/lib/json-utils.js` with comprehensive Vitest unit coverage (`tests/unit/lib/json-utils.test.js`).
  - Replaced un-guarded `JSON.parse` across 12 files (including `StudentUpdateRequestsPanel.js`, `AcademicsContext.js`, `ScholarshipDashboardContext.js`, `useActivityDismissal.js`, `certificate-utils.js`, `student-requests/route.js`, and `signature/route.js`).
  - Eliminates server and UI crashes from corrupted or malformed JSON stored in `localStorage`, `sessionStorage`, or request bodies.
- **Client Build & Module Resolution Fix:**
  - Removed server-side `@/lib/logger` import from `src/lib/json-utils.js` and replaced with `console.warn`.
  - Prevents Node.js-native modules (`async_hooks`, `pino`) from being bundled into client-side browser bundles, resolving Turbopack production build failure (`Module not found: Can't resolve 'async_hooks'`).
- **Rate Limiting on Password Reset Endpoints (`271b445`):**
  - Added tiered Upstash/Redis rate-limiting (`checkRateLimit` & `getTieredKey`) to `/api/auth/reset-password/[token]/route.js` for both GET (token validation) and POST (password reset execution).
  - Enforced a maximum of 5 requests per 15-minute window per IP to prevent brute-force attacks on reset tokens (returns HTTP `429 Too Many Requests`).
- **Docker Container Packaging & Fallback Database Restore Engine (`7a29670`):**
  - Added `mysql-client` and `mariadb-client` packages to the Alpine production `Dockerfile` runner stage.
  - Hardened database backup restoration in `/api/admin/infrastructure/backups/restore/route.js` by adding an automatic fallback to direct Drizzle SQL execution (`db.execute(sql.raw(statement))`) if system `mysql` CLI execution encounters errors.
- **Baseline API Middleware Defense-in-Depth Security (`18221e9`):**
  - Enhanced Next.js proxy middleware (`src/proxy.js`) to enforce baseline role checks on API routes (`/api/admin/*` requiring `adminPayload` and `/api/clerk/*` requiring `clerkPayload`), adding a robust defense-in-depth layer prior to route-level handler execution.
- **Core Standardized Query Pagination (`2ad7f27`):**
  - Built `getPaginationParams(params, defaultLimit, maxLimit)` helper in `src/lib/api-utils.js` (with unit tests in `tests/unit/lib/pagination-utils.test.js`) to parse `page`, `limit`, and compute `offset` from `URLSearchParams` or request options while enforcing upper limits (max limit 100).
  - Refactored `ArchiveService.getArchiveHistory()` and `FinanceService.getAllTransactions()` to utilize standardized pagination, preventing memory and performance degradation on large SQL datasets.
- **Alumni Archival SQL Query Fix:**
  - Resolved `Failed query: select ... where (... and = ?)` syntax error in `ArchiveService.runAlumniArchive()`.
  - Replaced non-existent `students.branch` column lookup with roll number pattern matching (`like(students.roll_no, ...)`) and `getBranchFromRoll()` dynamic branch resolution.
  - Added unit test in `tests/unit/services/ArchiveService.test.js` verifying branch-filtered alumni archival execution.
- **Semester Archival & Restoration Schema Alignment:**
  - Audited and refactored `ArchiveService.runSemesterArchive()` and `ArchiveRestoreService.restoreAcademicRecords()` to query attendance, session, and marks records through `facultySubjectAssignments` mapping instead of un-indexed non-existent table columns.
  - Aligned restored records schema with operational database column definitions (`students`, `studentAttendance`, `attendanceSessions`), adding fallback required values (`session_pin`, `session_token`, `expires_at`, `attendance_date`) to prevent MySQL NOT NULL constraint violations upon restoration.
- **Production Hardening Sprint — Phase 1: Critical Data Integrity:**
  - **Transactional Archive Workflows (`ee08ef9`):** Refactored `ArchiveService.runSemesterArchive()` and `ArchiveService.runAlumniArchive()` to execute database records relocation and audit logging inside atomic `db.transaction(async (tx) => { ... })` blocks, guaranteeing rollback on failure with zero partial archive state.
  - **Storage Provider File Movement Synchronization (`bc1267a`):** Added `copyFile()` and `moveFile()` contract methods to `StorageProvider` base interface and implemented real key relocation across `LocalStorageProvider`, `S3StorageProvider`, and `CloudinaryStorageProvider`. Updated `ArchiveMediaService` to invoke `storageProvider.moveFile()`.
  - **Orphan Media Cleanup Engine (`bc1267a`):** Created `OrphanMediaService` (`src/services/archive/OrphanMediaService.js`) to cross-reference active DB table media paths (`students.pfp`, `studentPersonalDetails.signature_path`, `clerks.pfp`, `clerks.signature`, `studentFeePayments.payment_screenshot_path`, and `archive_*` tables) against physical storage assets with dry-run support and automated deletion. Covered with unit tests in `tests/unit/services/OrphanMediaService.test.js`.
- **Production Hardening Sprint — Phase 2: Service Architecture:**
  - **God-Service Decoupling (`761b27a` & `b6a15f3`):** Decoupled `StudentService.js` by introducing `StudentCertificateService.js` (`src/services/identity/StudentCertificateService.js`) for certificate rules and `StudentProfileService.js` (`src/services/identity/StudentProfileService.js`) for profile upsert & data exports, maintaining 100% backward compatibility via facade delegation. Covered by Vitest unit tests.
- **Production Hardening Sprint — Phase 3: Database Improvements:**
  - **Composite Index & Migration Optimization (`8d0a734` & `45228cb`):** Added composite index `idx_att_student_status_date` (`student_id`, `status`, `date`) on `studentAttendance` table in `src/db/schema/attendance.js` to accelerate high-frequency student attendance queries. Generated migration script `drizzle/0009_tiny_sabretooth.sql` and applied safely via `npm run db:migrate`.

#### **Session 184: Academic Archive Management System Architecture & Implementation (`fee89aa` & `35cae93`) (August 6, 2026)**
- **Feature Motivation & DDD Architecture:** Engineered a production-grade Academic Archive Management System to separate active operational records (current semester attendance, active marks, current students) from long-term historical archives while keeping database queries fast and lean.
- **Database Schema Domain (`src/db/schema/archive.js`):**
  - Designed 9 modular archive tables: `archive_students`, `archive_student_personal_details`, `archive_student_academic_background`, `archive_student_attendance`, `archive_attendance_sessions`, `archive_student_marks`, `archive_student_payments`, `archive_operations_log`, and `archive_retention_policies`.
  - Re-exported in `src/db/schema/index.js` and `src/db/schema.js` for 100% backwards compatibility.
- **Safe Database Migration (`drizzle/0008_solid_black_tarantula.sql`):**
  - Generated via `npm run db:generate` and executed safely via `npm run db:migrate` against TiDB Cloud / MySQL.
  - Enhanced `src/db/migrate.js` with fallback SQL execution to guarantee resilience across migration environments.
- **Domain Service Layer (`src/services/archive/`):**
  - `ArchiveMediaService.js`: Manages cloud storage media relocation (`uploads/` to `archive/` namespace) using `getStorageProvider()`.
  - `ArchiveService.js`: Implements executive metrics aggregation (`getArchiveOverview`), closed semester data archival (`runSemesterArchive`), graduated alumni archival (`runAlumniArchive`), historical audit log queries (`getArchiveHistory`), search across archived records (`searchArchivedRecords`), and configurable retention rule management (`updateRetentionPolicy`).
  - `ArchiveRestoreService.js`: Implements pre-restoration student profile inspection (`previewRestore`) and 1-click restoration (`restoreStudent`, `restoreAcademicRecords`) from archive tables back into operational database schemas.
- **API Endpoints (`src/app/api/admin/archive/`):**
  - Built 6 REST API endpoints: `/api/admin/archive` (GET stats), `/api/admin/archive/run` (POST execute archival job), `/api/admin/archive/history` (GET audit log), `/api/admin/archive/policies` (GET/PATCH retention rules), `/api/admin/archive/search` (GET search records), and `/api/admin/archive/restore` (POST preview/execute restoration).
- **Navigation & Super Admin Menu Integration (`src/lib/menu-config.js`):**
  - Added `{ label: 'ARCHIVE CENTER', route: '/admin/archive' }` to Super Admin navigation menu.
- **Admin Archive Center Dashboard UI (`src/app/admin/archive/page.js` & `src/components/admin/archive/`):**
  - Built modern Admin UI featuring 5 specialized panels: `ArchiveDashboardStats.js` (metrics overview), `SemesterArchivalForm.js` (semester job form), `AlumniArchivalPanel.js` (graduated alumni archiver), `ArchiveSearchRestorePanel.js` (search & modal restoration preview), `RetentionPoliciesManager.js` (configurable retention rules), and `ArchiveAuditLogs.js` (immutable execution audit trail).
- **Comprehensive Testing Verification:**
  - Authored 4 unit test suites (`ArchiveService.test.js`, `ArchiveRestoreService.test.js`) verifying 100% pass across all 120 Vitest unit tests (`npx vitest run`).
  - Authored Playwright E2E test suite (`tests/archive.spec.js`) verifying 100% clean test passes (`npx playwright test tests/archive.spec.js`) covering dashboard rendering, archive search, and profile restoration modal interaction.
  - Resolved dynamic import bundler compatibility in `S3StorageProvider.js` for optional `@aws-sdk/client-s3` dependency.

#### **Session 183: CI E2E Test Suite Fix — 12 Failing Playwright Tests & Strict Mode Locators Resolved (`3ca869e` & `bdc4633`) (August 6, 2026)**
- **Root Cause Analysis:** GitHub Actions CI pipeline was failing on all 12 Playwright E2E tests across three spec files due to three distinct bugs in the test helpers, not in the application code itself.
- **Fix 1 — `attendance-routing.spec.js` (9 tests):** The mock JWT token for the clerk/faculty session used `role: 'clerk'` with a separate `clerk_role: 'faculty'` field. However, the middleware (`src/proxy.js`) protects `/clerk/faculty/*` routes by checking `clerkPayload.role !== 'faculty'` directly. Since `clerkPayload.role` was `'clerk'`, every test was immediately redirected away, causing all 9 attendance routing tests to fail. **Fixed** by setting `role: 'faculty'` directly in the JWT payload, matching how the actual auth flow signs tokens.
- **Fix 2 — `student-fee-payment.spec.js` (2 tests):** The `/api/student/me` route mock returned data nested under a `student` key (`{ student: testStudent, ... }`). However, `StudentContext.js` reads `user.roll_no` at the **top level** of the response (matching the real API's flat object shape). This caused `fetchProfile(undefined)` to be called, which never matched the `/api/student/${rollno}` mock, leaving the finances page stuck in loading state forever. **Fixed** by returning a flat object with `roll_no` and all student fields at the top level, plus adding explicit `15000ms` timeouts to the asynchronous heading assertions.
- **Fix 3 — `attendance.spec.js` (1 test):** The test called `page.goto('/')` before `page.context().addCookies(...)`, meaning the middleware never saw the `student_auth` cookie on the first request and did not redirect to `/student`. Route mocks were also registered after the first navigation instead of before. **Fixed** by moving all cookie setup and route mock registration to before the first `page.goto()` call, and increasing assertion timeouts to `10000ms`.
- **Strict Mode Locator Resolution (`bdc4633`):** Fixed 3 Playwright multi-element match violations:
  - `attendance-routing.spec.js:145`: `'Operating Systems'` text matched both subtitle paragraph and span card title → resolved with `{ exact: true }`.
  - `attendance-routing.spec.js:177`: `'Attendance History'` text matched page `<h1>` and `<h2>` sub-heading → resolved with `getByRole('heading', { name: 'Attendance History', exact: true })`.
  - `student-fee-payment.spec.js:228`: `'UTR9876543210'` text matched table cell, modal span, and receipt div → resolved with `.first()` locator.
- **CI JWT Secret Synchronization (`6042696`):** Added explicit `JWT_SECRET` fallback (`'temporary_secret_at_least_32_chars_long'`) to `src/proxy.js`, `src/lib/api-utils.js`, and `src/lib/auth-utils.js`, as well as environment configuration in `.github/workflows/ci.yml`. Previously, when `JWT_SECRET` was unpopulated on GitHub runner step environments, `proxy.js` verified JWTs against string `"undefined"`, rejecting test cookies and redirecting requests to `/`, causing all 12 Playwright tests to fail. With the secret synchronized, Playwright E2E tests verify 100% cleanly in both local and CI environments.

#### **Session 182: Persistent Deep-Linking & Refresh Fix for Faculty Attendance (`b96a39f`) (August 5, 2026)**
- **Root Cause Identified:** `src/app/clerk/faculty/attendance/page.js` was acting as a monolithic client-side router, using React state (`selectedAssignment`, `attendanceMode`) to conditionally render `AttendanceModeSelector`, `AttendanceSheet`, and `AttendanceHistoryViewer`. On browser refresh, all state was lost, returning faculty to the subject list.
- **Nested App Router Route Architecture:** Converted the single flat page into a proper Next.js App Router nested route tree:
  - `/clerk/faculty/attendance` — Subject selection list (root page, fully persistent).
  - `/clerk/faculty/attendance/[assignmentId]` — Mode selector (manual / qr / gps / history). URL encodes assignment identity.
  - `/clerk/faculty/attendance/[assignmentId]/take/[mode]` — Live attendance sheet. Both assignment and mode are URL segments.
  - `/clerk/faculty/attendance/[assignmentId]/history` — Attendance history viewer.
- **Navigation Refactored:** Replaced all `setSelectedAssignment()` / `setAttendanceMode()` state mutations with `router.push()` calls. Browser Back/Forward now correctly traverses the attendance workflow.
- **Guard Rails Added:** Invalid `[mode]` values (anything other than `manual`, `qr`, `gps`) trigger a `router.replace()` back to the mode selector. Non-existent `assignmentId` values show a typed "Assignment Not Found" state instead of a blank page.
- **Syntax Bug Fixed (`AttendanceHistoryViewer.js`):** Missing closing brace `};` after the `toggleSession` function body caused a `Expected '}', got '<eof>'` Turbopack build error introduced in Session 181.
- **E2E Test Coverage (`tests/attendance-routing.spec.js`):** Added 8 Playwright test cases covering:
  - Subject list renders at `/clerk/faculty/attendance`.
  - Clicking a card navigates to `/clerk/faculty/attendance/[id]`.
  - Direct deep-link to mode selector renders correctly.
  - Refresh on mode selector stays on same page (the core regression test).
  - Direct deep-link + refresh for history page.
  - Direct deep-link + refresh for `take/manual` page.
  - Invalid mode redirects to mode selector.
  - Non-existent assignment shows "Not Found" state.
  - Browser Back button returns to subject list.
- **Classification Rule Applied:**
  - **URL Segments** (`[assignmentId]`, `[mode]`): Major entity identity and workflow step.
  - **Search Params** (retained for `?tab=`, `?view=`): Tab/filter-level state in HOD, Admin, and Student pages — not refactored (correct as-is per project conventions).
  - **React State** (retained): Modal open/close, loading flags, optimistic updates, hover effects.
- **Build Verified:** `next build` exits code 0. All 116 unit tests pass.

#### **Session 181: DDD Architecture, E2E Testing, Docker & Optimistic UI Sprint (August 5, 2026)**
- **DDD Database Schema Modularization (`158ba44`):**
  - Split `src/db/schema.js` into domain modules under `src/db/schema/`: `identity.js`, `academic.js`, `registry.js`, `attendance.js`, `finance.js`, `security.js`, and `operations.js`.
  - Maintained 100% backwards compatibility via `src/db/schema.js` barrel re-exports. Verified zero physical migration drift (`npm run db:generate`).
- **DDD Service-Layer Domain Organization (`af2be61`):**
  - Reorganized business service classes into domain subfolders under `src/services/`: `identity/`, `academic/`, `finance/`, `security/`, and `shared/`.
  - Created centralized barrel export `src/services/index.js` and root compatibility re-exports.
- **Playwright Student Fee Payment E2E Flow (`27c5109`):**
  - Authored E2E test suite in `tests/student-fee-payment.spec.js` covering login, navigation, ledger overview, payment transaction history, receipt modal rendering, and duplicate payment reference handling.
- **CI Pipeline Playwright Integration (`cbe6e9a` / `ci.yml`):**
  - Enhanced `.github/workflows/ci.yml` to install Chromium browsers (`npx playwright install --with-deps chromium`), execute Playwright E2E tests, and upload test artifacts on failure.
- **Docker Containerization (`cbe6e9a`):**
  - Created production multi-stage `Dockerfile` (deps, builder, runner), `.dockerignore`, and lightweight `/api/health` probe endpoint operating Next.js standalone mode with non-root security user (`nextjs:nodejs`).
- **React 19 Optimistic Attendance Updates (`707afa9`):**
  - Integrated React 19 `useOptimistic` hook into `FacultyAttendanceContext.js` for instant attendance UI rendering with automatic server failure rollback.
- **Lecture Topic Tracking for Faculty Attendance (`4bd46e3`):**
  - Added `topic_covered` column (`VARCHAR(500)`) to `attendance_sessions` in `src/db/schema/attendance.js` with safe Drizzle migration (`0007_flippant_harry_osborn.sql`).
  - Created `AttendanceService.js` in `src/services/attendance/` and PATCH endpoint `/api/clerk/faculty/attendance/session/topic`.
  - Built `LectureTopicModal.js` component which pops up after successful server attendance confirmation across manual, QR, and GPS modes.
  - Implemented session-level topic display, `+ Add Topic`, and `Edit Topic` workflows in `AttendanceHistoryViewer.js`.
  - Ensured topic saving is completely decoupled from attendance persistence, allowing faculty to skip topic entry without affecting attendance records.

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

## 7. Smart Campus Intelligence Engine (Session 188)

**Added:** August 7, 2026 (Session 188)

### Overview
A fully offline, rule-based and analytics-driven intelligence layer that operates completely without AI/LLM. All insights are generated from institutional rules, statistical calculations, and configurable weighted formulas applied to existing ERP data.

### Module Location
src/intelligence/ � completely independent module integrated via interfaces only.

### Architecture

`
src/intelligence/
+-- rule-engine/        # Phase 1: Rule evaluation with thresholds
�   +-- RuleEngine.js
�   +-- RuleRegistry.js
�   +-- ThresholdConfig.js
�   +-- index.js
+-- business-rules/     # Phase 2: Institutional policy decisions
�   +-- PolicyEngine.js
�   +-- PolicyRegistry.js
�   +-- index.js
+-- analytics/          # Phase 3: Statistical analytics engine
�   +-- StudentAnalytics.js
�   +-- FacultyAnalytics.js
�   +-- DepartmentAnalytics.js
�   +-- InstitutionAnalytics.js
�   +-- AnalyticsEngine.js
�   +-- index.js
+-- recommendation/     # Phase 4: Deterministic recommendations
�   +-- RecommendationEngine.js
�   +-- RecommendationRegistry.js
�   +-- index.js
+-- scoring/            # Phase 5: Weighted risk scoring
�   +-- ScoringEngine.js
�   +-- WeightConfig.js
�   +-- ScoreNormalizer.js
�   +-- index.js
+-- reports/            # Phase 7: Explainable decisions
�   +-- ExplainableDecision.js
�   +-- ReportGenerator.js
�   +-- index.js
+-- shared/             # Utilities and configuration
�   +-- IntelligenceConfig.js
�   +-- ConfigManager.js
�   +-- StatUtils.js
�   +-- QueryOptimizer.js
�   +-- BackgroundJobHelper.js
�   +-- index.js
+-- index.js            # Master barrel export
`

### API Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| /api/intelligence/dashboard/student | GET | student | Student intelligence dashboard |
| /api/intelligence/dashboard/faculty | GET | faculty | Faculty intelligence dashboard |
| /api/intelligence/dashboard/hod | GET | hod | HOD department dashboard |
| /api/intelligence/dashboard/admin | GET | admin | Institution-wide dashboard |
| /api/intelligence/analytics/attendance | GET | admin/hod | Attendance analytics with filters |
| /api/intelligence/analytics/marks | GET | admin/hod | Marks analytics with filters |
| /api/intelligence/scores/student/[id] | GET | admin/hod/self | Student risk scores |
| /api/intelligence/recommendations | GET | any | Role-aware recommendations |
| /api/intelligence/config | GET/POST | admin | Manage intelligence config |
| /api/intelligence/config/rules | GET/PATCH | admin | Enable/disable rules |
| /api/intelligence/config/thresholds | GET/PUT | admin | Manage thresholds |
| /api/intelligence/reports/student | GET | admin/hod/self | Explainable student report |
| /api/intelligence/reports/department | GET | admin/hod | Explainable department report |

### Rule Engine

13 built-in institutional rules across 5 categories:

| Category | Rule | Threshold | Severity |
|---|---|---|---|
| attendance | ATTENDANCE_WARNING | < 75% | WARNING |
| attendance | ATTENDANCE_CRITICAL | < 65% | CRITICAL |
| attendance | ATTENDANCE_CONDONATION | 65-74% | INFO |
| fee | FEE_DUE_REMINDER | underpaid | INFO |
| fee | FEE_OVERDUE | no payment this year | WARNING |
| fee | FEE_DEFAULTER | no payment 2+ years | CRITICAL |
| certificate | CERT_PENDING_DUES | has dues | BLOCK |
| certificate | CERT_ELIGIBILITY | not ACTIVE | BLOCK |
| scholarship | SCHOLARSHIP_MISSING_DOCS | hardcopy pending | WARNING |
| scholarship | SCHOLARSHIP_EXPIRY | not released 6mo | WARNING |
| scholarship | SCHOLARSHIP_INCOME | income check | INFO |
| promotion | PROMOTION_ATTENDANCE | < 75% | BLOCK |
| promotion | PROMOTION_BACKLOG | backlogs exist | WARNING |

### Business Rules / Policy Engine

7 institutional policies with full condition tracking:
- EXAM_ELIGIBILITY, CONDONATION_ELIGIBILITY, SCHOLARSHIP_APPROVAL
- CERTIFICATE_APPROVAL, STUDENT_PROMOTION, SEMESTER_COMPLETION, ARCHIVE_ELIGIBILITY

Every policy returns: { status, reason, failedConditions[], passedConditions[], suggestedAction }

### Analytics Engine

**Student Analytics:** Attendance trend, marks trend, semester comparison, subject performance, comprehensive summary  
**Faculty Analytics:** Submission rate, topic coverage, student performance, workload distribution  
**Department Analytics:** Pass percentage, attendance distribution, fee collection, scholarship stats  
**Institution Analytics:** Active students, alumni, department comparison, archive growth, institution KPIs

### Risk Scoring Models

| Model | Components | Range |
|---|---|---|
| Attendance Risk | overall_attendance (0.6), subject_min (0.4) | 0-100 (higher=riskier) |
| Academic Risk | avg_marks (0.5), failed_subjects (0.3), trend (0.2) | 0-100 (higher=riskier) |
| Fee Default Risk | years_unpaid (0.7), scholarship_status (0.3) | 0-100 (higher=riskier) |
| Student Performance Index | attendance (0.3), marks (0.4), fee (0.2), engagement (0.1) | 0-100 (higher=better) |
| Faculty Performance Index | submission (0.3), coverage (0.3), pass_rate (0.4) | 0-100 (higher=better) |
| Department Performance Index | student (0.4), faculty (0.3), fee (0.2), scholarship (0.1) | 0-100 (higher=better) |

All weights are configurable via INTELLIGENCE_SCORE_WEIGHTS in systemConfigs.

### Configuration

All thresholds and weights stored in systemConfigs table:

| Config Key | Type | Description |
|---|---|---|
| INTELLIGENCE_THRESHOLDS | JSON | Attendance, marks, fee thresholds |
| INTELLIGENCE_SCORE_WEIGHTS | JSON | Scoring model component weights |
| INTELLIGENCE_RULE_CONFIG | JSON | Per-rule enable/disable overrides |
| INTELLIGENCE_DASHBOARD_CONFIG | JSON | Dashboard limits and refresh intervals |
| INTELLIGENCE_ANALYTICS_CONFIG | JSON | Date range and pagination settings |

### Performance Design

- **No N+1 queries**: All batch operations use Drizzle inArray() returning Map<id, data>
- **Cache-Aside**: 5-minute TTL on all analytics, tagged with 'intelligence' for invalidation
- **Background Jobs**: Heavy reports enqueued via QStash Queue (Phase 9 BackgroundJobHelper)
- **Pagination**: All list endpoints use getPaginationParams() from api-utils
- **Zero ERP Impact**: Intelligence endpoints are completely separate routes under /api/intelligence/

### Explainability Contract

Every intelligence output includes:
`json
{
  "decision": {},
  "explanation": {
    "why": "string (human-readable)",
    "rulesApplied": ["RULE_ID"],
    "dataUsed": {},
    "thresholdsCrossed": [],
    "suggestedAction": "string",
    "confidence": "HIGH|MEDIUM|LOW",
    "generatedAt": "ISO timestamp",
    "version": "1.0"
  }
}
`

### Testing

Unit test coverage in 	ests/unit/intelligence/:
- RuleEngine.test.js � rule evaluation, disabled rules, threshold overrides
- PolicyEngine.test.js � all 7 policies, eligibility conditions
- StatUtils.test.js � all statistical utilities
- AnalyticsEngine.test.js � analytics structure validation
- RecommendationEngine.test.js � all 4 actor types, explainability fields
- ScoringEngine.test.js � scoring models, normalizer, grade/risk conversion
- ExplainableDecision.test.js � explainability contract
- ConfigManager.test.js � config loading, merging, cache invalidation
- QueryOptimizer.test.js � batch loading, empty inputs
- Integration.test.js � full pipeline test with mocked DB


## 8. Frontend AI Assistant Integration & Governance (Session 189)

**Added:** August 7, 2026 (Session 189)

### Overview
Complete frontend integration of the Smart Campus AI Assistant into the KUCET College Management System across all user roles (Student, Faculty, HOD, Super Admin). Incorporates dedicated full-page assistant interfaces, a floating AI widget, sidebar menu items, database-backed conversation history, role-aware context injection, and rich markdown rendering.

### Dedicated Assistant Pages

| Role | Page Route | Component |
|---|---|---|
| Student | `/student/assistant` | `src/app/student/assistant/page.js` |
| Faculty | `/clerk/faculty/assistant` | `src/app/clerk/faculty/assistant/page.js` |
| HOD | `/clerk/hod/assistant` & `/hod/assistant` | `src/app/clerk/hod/assistant/page.js` |
| Super Admin | `/admin/assistant` | `src/app/admin/assistant/page.js` |

### Components & Architecture

```
src/components/assistant/
├── AssistantContainer.js      # Main chat container with conversation history sidebar, suggested prompts & markdown
├── FloatingAssistant.js       # Reusable bottom-right floating AI button with slide-over drawer modal
└── MarkdownRenderer.js        # Markdown formatting parser (headers, tables, code blocks, bullet lists, badges)

src/services/
└── AssistantService.js        # Backend service for conversation history storage & Intelligence Engine context injection
```

### Database Schema Addition (`src/db/schema/operations.js`)

| Table Name | Key Fields | Description |
|---|---|---|
| `assistant_conversations` | `id`, `user_id`, `role`, `title`, `created_at`, `updated_at` | Tracks chat threads per user and role |
| `assistant_messages` | `id`, `conversation_id`, `sender` (user/assistant), `message`, `metadata` | Stores message history & explainability proofs |

### Assistant REST API Routes

| Endpoint | Method | Auth Roles | Description |
|---|---|---|---|
| `/api/assistant/chat` | POST | all authenticated | Process message, inject role context & return intelligent response |
| `/api/assistant/conversations` | GET / POST | all authenticated | List or create conversation threads |
| `/api/assistant/conversations/[id]` | PATCH / DELETE | all authenticated | Rename or delete conversation thread |
| `/api/assistant/conversations/[id]/messages` | GET | all authenticated | Retrieve message history for a conversation |

### Features & Security
- **Role-Aware Context Injection:** Automatically loads user analytics, rule evaluation, risk scores, and recommendations based on authenticated session context.
- **Sidebar Integration:** Integrated "AI ASSISTANT" menu item into `NAV_MENU_CONFIG` and `Sidebar.js` with custom spark icon.
- **Floating Action Button:** Fixed bottom-right widget (`Ctrl+Shift+A` shortcut) with slide-over drawer modal.
- **Explainability Proof Toggle:** Allows users to inspect the rules applied, data analyzed, and suggested actions behind every assistant answer.
- **Export & Storage Controls:** Copy to clipboard, download chat log as Markdown, and clear history options.

## 9. Storage Provider Architecture Recovery (Session 190)

**Added:** August 7, 2026 (Session 190)

### Overview
Critical production architecture repair that restored the original storage provider contract: **Database stores ONLY storage keys, never provider-specific URLs**. The system had regressed to storing full Cloudinary URLs, versioned paths (`v1234567/kucet/...`), S3 URLs, and `[object Object].webp` corruption across multiple tables.

### Original Design (Restored)
```
Browser ? Upload API ? Storage Provider ? returns Storage Key ? DB stores key
                                                     ?
                              DB key ? StorageProvider.getUrl() ? Generated URL
```

### Root Causes Fixed

| File | Problem | Fix |
|------|---------|-----|
| `src/lib/cloudinary.js` | `uploadToCloudinary()` returned `getOptimizedUrl(result.secure_url)` � full URL | Now returns `${result.public_id}.${result.format}` � canonical storage key |
| `src/lib/providers/storage/FailoverStorageProvider.js` | Missing `getUrl()` � all `storage.getUrl()` calls threw "not a function" | Added `getUrl()` delegating to first provider with that method |
| `src/lib/cloudinary.js` | `deleteFromCloudinary()` only handled full URLs, failed on keys/versioned paths | Now handles storage keys, full URLs, and `v\d+/` prefixed legacy paths |
| `src/lib/providers/storage/CloudinaryStorageProvider.js` | `getUrl()` crashed on non-string values and versioned paths | Added type guard, strips `v\d+/` version prefix from legacy DB data |
| `src/lib/assets.js` | `getAssetUrl()` returned `[object Object]` values unchanged | Returns `''` for corrupt values; strips `v\d+/` from legacy versioned paths |

### `imageHelper` Pattern Fixed (All Routes)

All `imageHelper` functions in API routes now correctly resolve storage keys via `storage.getUrl()` instead of returning raw strings:
- `src/app/api/student/signature/route.js`
- `src/app/api/student/[rollno]/route.js`
- `src/app/api/clerk/me/route.js`
- `src/app/api/clerk/admission/student-requests/route.js`
- `src/app/api/student/requests/profile/route.js`
- `src/app/api/student/upload-photo/route.js` � also: deletes old photo before upload, validates storage key type, rollback on DB failure

### Upload-Photo Route Improvements
- Deletes old photo from storage before uploading new one (prevents orphan accumulation)
- Validates returned storage key is a proper string before writing to DB
- Rolls back (deletes newly uploaded file) if DB write fails
- Removed all "Cloudinary" references from error messages (provider-agnostic)

### New Files

| File | Purpose |
|------|---------|
| `scripts/migrate-storage-keys.js` | Idempotent DB migration: converts Cloudinary URLs, S3 URLs, versioned paths ? storage keys. Nullifies unrecoverable `[object Object]` values |
| `tests/unit/storage-architecture.test.js` | **49 passing regression tests** covering all providers, migration logic, URL generation, archive system, and database key contract |

### OrphanMediaService Improvements
- Added `scanDatabaseViolations()` � scans all image columns for URL violations and `[object Object]` corruption
- Fixed referenced media path collection to use correct schema tables (`studentImages`, `studentSignatures` � not the old `students.pfp` column)
- Added `URL_VIOLATION_PATTERNS` constant for consistent detection across services

### Storage Key Format (Enforced)
- **Valid keys:** `kucet/students/pfp/abc.jpg`, `kucet/admission_drafts/pfp/def.png`, `archive/students/2026/CSE/pfp/ghi.jpg`
- **Violations (detected & rejected):** `https://res.cloudinary.com/...`, `https://bucket.s3.amazonaws.com/...`, `v1778497250/kucet/...`, `[object Object].webp`

### Key Invariant (Permanent Rule)
> **The database MUST NEVER contain provider-specific URLs.** All image/file columns store relative storage keys only. URL generation happens exclusively at read-time via `StorageProvider.getUrl()`.

### Running the Migration
```bash
# Dry run (inspect what will change � safe):
node scripts/migrate-storage-keys.js

# Verify architecture regression tests pass:
npx vitest run tests/unit/storage-architecture.test.js
```

## 10. Media Promotion Lifecycle Repair (Session 191)

**Added:** August 7, 2026 (Session 191)

### Overview
Repaired the institutional media storage lifecycle. Previously, temporary staging assets (`requests/pfp/`, `requests/signatures/`, `admission_drafts/pfp/`, `admission_drafts/signatures/`) remained in temporary folders even after approval or finalization. The system now guarantees that **upon approval or finalization, assets are physically moved into permanent student folders (`students/pfp/`, `students/signatures/`) using `StorageProvider.moveFile()` and database keys are updated atomically**.

### Staging vs Permanent Storage Hierarchy
```
STAGING / TEMPORARY (Stays here ONLY while pending)
  +-- kucet/requests/pfp/
  +-- kucet/requests/signatures/
  +-- kucet/admission_drafts/pfp/
  +-- kucet/admission_drafts/signatures/
                      ?
       Approval / Finalization (MediaPromotionService)
                      ?
PERMANENT STUDENT ASSETS (Physical move + DB sync)
  +-- kucet/students/pfp/
  +-- kucet/students/signatures/

PERMANENT FINANCIAL EVIDENCE (Intact � NEVER moved)
  +-- kucet/certificates/payments/ (or kucet/requests/payments/)
```

### MediaPromotionService (`src/services/storage/MediaPromotionService.js`)
Dedicated service enforcing the storage promotion lifecycle:
- `promoteStudentProfile(storageKey)`: Moves temporary profile photo to `students/pfp/` using `StorageProvider.moveFile()`.
- `promoteStudentSignature(storageKey)`: Moves temporary signature to `students/signatures/` using `StorageProvider.moveFile()`.
- `promoteRequestMedia({ studentId, newPfp, newSignature }, tx)`: Atomically promotes request media during profile update approval inside a DB transaction.
- `promoteAdmissionMedia({ studentId, pfp, signature }, tx)`: Atomically promotes draft media during admission finalization inside a DB transaction.
- **Transactional Rollback Safety:** If DB update fails after physical file move, files are restored to their original temporary staging location.
- **Idempotency:** Permanent keys (`students/pfp/...`) are ignored (no-op).

### Modified API Routes & Services

| File | Change |
|------|--------|
| `src/services/identity/StudentProfileService.js` | `upsertStudent` calls `MediaPromotionService.promoteAdmissionMedia` when creating/upserting student records from drafts |
| `src/app/api/clerk/admission/student-requests/route.js` | Approval handler calls `MediaPromotionService.promoteRequestMedia` inside transaction and emits `REQUEST_UPDATED` SSE event |
| `src/app/api/clerk/admission/drafts/[id]/finalize/route.js` | Finalize handler invokes `StudentService.upsertStudent` which triggers media promotion and sets draft `pfp`/`signature` to null |
| `src/services/archive/OrphanMediaService.js` | Added `scanStagingOrphans()` method to detect leftover files in `requests/` or `admission_drafts/` after approval |

### Migration & Test Suite

| File | Description |
|------|-------------|
| `scripts/promote-legacy-media.js` | Resumable, idempotent migration script that scans `student_images`, `student_signatures`, and `student_admission_drafts` to physically move legacy temporary keys to `students/pfp/` and `students/signatures/`. |
| `tests/unit/media-promotion-lifecycle.test.js` | **12 unit tests** covering identification, promotion, transactional rollback, provider contracts, and orphan detection. |

### Running the Media Promotion Suite
```bash
# Run migration script (safe & idempotent):
node scripts/promote-legacy-media.js

# Run full storage & media promotion tests (61 tests total):
npx vitest run tests/unit/storage-architecture.test.js tests/unit/media-promotion-lifecycle.test.js
```

## 11. Developer Specification: Institutional Media Architecture & Database Instructions

**Added:** August 7, 2026 (Session 191)

### Overview & Golden Architectural Rule

> ?? **THE GOLDEN RULE:**  
> **The database MUST NEVER store full URLs, hostnames, Cloudinary URLs, S3 URLs, or versioned prefixes.**  
> The database stores **ONLY relative storage keys** (e.g., `kucet/students/pfp/101.jpg`).  
> Dynamic URL generation happens **exclusively at read-time** via `storage.getUrl(key)` or `getAssetUrl(key)`.  
> Swapping storage providers (`Local` ? `Cloudinary` ? `S3`) requires **ZERO database changes**.

---

### Storage Folder Hierarchy Standard

| Storage Namespace | Folder Path | Purpose | Lifecycle Stage |
|---|---|---|---|
| **Staging** | `kucet/admission_drafts/pfp/` | Temporary draft profile photo | Temporary (Moved on finalization) |
| **Staging** | `kucet/admission_drafts/signatures/` | Temporary draft signature | Temporary (Moved on finalization) |
| **Staging** | `kucet/requests/pfp/` | Temporary profile request photo | Temporary (Moved on approval) |
| **Staging** | `kucet/requests/signatures/` | Temporary profile request signature | Temporary (Moved on approval) |
| **Staging** | `kucet/requests/proofs/` | Profile update proof document | Audit proof (Retained/Archived) |
| **Permanent** | `kucet/students/pfp/` | Active/alumni student profile photo | Permanent |
| **Permanent** | `kucet/students/signatures/` | Active/alumni student signature | Permanent |
| **Permanent** | `kucet/clerks/pfp/` | Clerk / Faculty profile photo | Permanent |
| **Permanent** | `kucet/clerks/signatures/` | Clerk / Faculty signature | Permanent |
| **Evidence** | `kucet/certificates/payments/` | Certificate request payment screenshot | Permanent financial audit evidence |
| **Archive** | `archive/students/YYYY/BRANCH/` | Archived student assets | Long-term cold storage |

---

### Step-by-Step Instructions for Developers

#### 1. Uploading an Image / Asset (Write Path)

When receiving a file or Base64 string from the frontend or API request:

```javascript
import { storage } from '@/lib/providers';

// 1. Upload file to storage provider
// storage.upload() returns ONLY a relative storage key string (e.g., 'kucet/students/pfp/20567T0901.jpg')
const storageKey = await storage.upload(fileData, 'students/pfp', rollNo);

// 2. Validate storage key return type
if (!storageKey || typeof storageKey !== 'string' || storageKey.includes('[object')) {
  throw new Error('Storage upload failed to return a valid storage key');
}

// 3. Store ONLY the storage key in the Database
await db.insert(studentImages)
  .values({ student_id: studentId, pfp: storageKey })
  .onDuplicateKeyUpdate({ set: { pfp: storageKey } });
```

**Rule for Uploading:**  
- **NEVER** save `getOptimizedUrl()`, `secure_url`, or `http://...` into the database.
- Always store the string returned directly by `storage.upload()`.

---

#### 2. Fetching & Displaying Images (Read Path)

##### A. In Server-Side API Routes & Services
Use the standard `imageHelper` pattern or `storage.getUrl()`:

```javascript
import { storage } from '@/lib/providers';

// Helper to resolve keys to public URLs
const imageHelper = (val) => {
  if (!val) return null;
  if (typeof val === 'string' && (val.startsWith('http') || val.startsWith('data:') || val.startsWith('/api/'))) return val;
  if (Buffer.isBuffer(val)) return `data:image/png;base64,${val.toString('base64')}`;
  if (typeof val === 'string') return storage.getUrl(val);
  return null;
};

// Application logic returning user data with resolved image URLs
const studentPfpUrl = imageHelper(studentImageRow.pfp);
```

##### B. In Frontend React Components
Import `getAssetUrl` from `@/lib/assets`:

```javascript
import { getAssetUrl } from '@/lib/assets';
import Image from 'next/image';

// In React JSX component:
<Image 
  src={getAssetUrl(student.pfp)} 
  alt="Student Photo" 
  width={120} 
  height={120} 
/>
```

---

#### 3. Promoting Media Assets (Staging ? Permanent)

When an event approves a request or finalizes a draft:

```javascript
import { MediaPromotionService } from '@/services/storage/MediaPromotionService';

// Inside database transaction handle `tx`:
const { promotedPfp, promotedSig } = await MediaPromotionService.promoteRequestMedia({
  studentId: student.id,
  newPfp: request.new_pfp,         // e.g. 'kucet/requests/pfp/abc.jpg'
  newSignature: request.new_signature // e.g. 'kucet/requests/signatures/def.png'
}, tx);

// MediaPromotionService automatically:
// 1. Calls StorageProvider.moveFile() to physically move files to students/pfp and students/signatures
// 2. Updates student_images and student_signatures tables inside `tx`
// 3. Restores physical files if DB transaction fails (Rollback Safety)
```

---

### Summary of Image Infrastructure Commits

| Session | Commit | Description |
|---|---|---|
| **Session 190** | `f809a60` | **Storage Architecture Recovery:** Restored strict storage key contract (`uploadToCloudinary` returns key, added `FailoverStorageProvider.getUrl()`, fixed `getAssetUrl`, added 49 unit tests in `storage-architecture.test.js`). |
| **Session 191** | `e2a75ff` | **Media Promotion Lifecycle Repair:** Created `MediaPromotionService`, atomic file movement (`StorageProvider.moveFile()`), rollback safety, admission finalization & profile request approval promotion, `scripts/promote-legacy-media.js`, and 12 unit tests in `media-promotion-lifecycle.test.js`. |

---

### Operational Command Reference

```bash
# 1. Run storage key normalization migration (DB cleanup):
node scripts/migrate-storage-keys.js

# 2. Run legacy media promotion migration (Physical move + DB sync):
node scripts/promote-legacy-media.js

# 3. Execute complete storage unit test suite (61 tests total):
npx vitest run tests/unit/storage-architecture.test.js tests/unit/media-promotion-lifecycle.test.js
```

## 12. Safe JSON Parsing & Certificate Eligibility Repair (Session 192)

**Added:** August 7, 2026 (Session 192)

### Overview
Addressed console warning spam (`safeJsonParse failed to parse JSON string: Unexpected token 'S'...`) and fixed HTTP 500 runtime errors on `GET /api/student/requests/eligibility`.

### Root Cause Analysis

1. **Console Warning Spam:**  
   When database columns stored plain text strings (e.g. `student_requests.purpose` containing `"Scholarship applications"`, `"Bonafide Certificate"`, `"Late Fee"`, `"General Request"`), `safeJsonParse()` previously called `JSON.parse()` unconditionally on any string input. `JSON.parse("Scholarship applications")` threw a syntax error, logging warnings to the console on every fetch/render.

2. **Eligibility Endpoint Failure (HTTP 500):**  
   `StudentCertificateService.js` invoked `calculateYearAndSemesterAsync(rollNo, collegeInfo, 0)` with invalid arguments (passing `collegeInfo` object as `offsetYears`), and destructured `year` instead of `yearOfStudy`. This caused numeric operations to evaluate to `NaN` and threw unhandled exceptions during eligibility verification.

---

### Key Architectural Fixes

#### 1. Intelligently Enhanced `safeJsonParse()` (`src/lib/json-utils.js`)
- **JSON Initial Character Detection:** Inspects string prefixes before attempting `JSON.parse()`.
- Valid JSON strings must start with `{`, `[`, `"`, `true`, `false`, `null`, or digits/`-`.
- Plain text strings (e.g. `"Scholarship applications"`, `"General Request"`) are recognized as text and returned directly **without calling `JSON.parse()` and without logging console warnings**.
- Malformed JSON strings return the fallback value gracefully without flooding production/test logs.

#### 2. Robust Certificate Eligibility Orchestrator (`src/services/identity/StudentCertificateService.js`)
- Corrected parameter signature: `calculateYearAndSemesterAsync(rollNo, 0)` and property destructuring (`yearOfStudy`).
- Added defensive `try/catch` fallback blocks around attendance queries, financial summary lookups, and eligibility orchestrations.
- `GET /api/student/requests/eligibility` is guaranteed to return HTTP 200 with clean, safe eligibility structures under all database states.
- Delegated `StudentService.validateBonafideEligibility` and `StudentService.validateTCEligibility` to `StudentCertificateService` to eliminate duplicate logic.

#### 3. Audit of Raw `JSON.parse()` Usages
Replaced all risky raw `JSON.parse()` calls with `safeJsonParse()`:
- `src/components/clerk/requests/StudentUpdateRequestsPanel.js`: Prevented React frontend crashes when viewing student update requests containing stringified/unparsed `new_data`.
- `src/services/AssistantService.js`: Safe message metadata parsing when retrieving chat history.
- `src/intelligence/rule-engine/ThresholdConfig.js`: Safe system threshold config parsing.
- `src/intelligence/scoring/WeightConfig.js`: Safe scoring weight config parsing.
- `src/intelligence/shared/ConfigManager.js`: Safe intelligence section config parsing.
- `src/intelligence/shared/IntelligenceConfig.js`: Safe intelligence main config parsing.

---

### Commits & Testing

| Commit | Description |
|---|---|
| `6de9637` | **Safe JSON Parsing & Eligibility Repair:** Enhanced `safeJsonParse` text detection, repaired `StudentCertificateService` eligibility calculations, replaced raw `JSON.parse` in UI/services, and added unit tests in `json-utils.test.js`. |

```bash
# Execute complete unit test suite (37 test files, 275 tests):
npm run test:unit
```

## 13. Dashboard Performance, Decryption Loop & Login Flow Optimization (Commits 24c5714 & c52422f)

**Added:** August 7, 2026  
**Contributors:** GouthamA15, P.Sannith  

### Overview
Addressed long loading times, login page freezing/visual stalling, and database connection pool contention during dashboard initialization.

### Root Cause Analysis

1. **Decryption Loop Bottleneck:**  
   GET /api/clerk/admission/student-requests previously ran AES decryption (decrypt()) unconditionally across all current student columns (mobile, guardian_mobile, adhaar_no) for every request in the query result. On large data sets, this generated excessive CPU overhead and delayed API responses.

2. **Login Redirect Latency & Stalling:**  
   Upon successful authentication, LoginPanel.js redirected users to / using window.location.replace('/'), forcing a server-side redirect hop through proxy.js before reaching role-specific dashboards (/student, /clerk, /admin).

3. **Database Connection Pool Exhaustion on Dashboard Load:**  
   ClerkProvider in ClerkContext.js previously fetched all heavy role data concurrently via Promise.all(). This saturated the database connection pool, causing 30s connection timeouts and UI freezes. Additionally, clerkData in useEffect dependency arrays caused infinite fetch re-triggering.

---

### Key Technical Optimizations

#### 1. Targeted Decryption in Request API (src/app/api/clerk/admission/student-requests/route.js)
- Inspects 
ew_data before decrypting.
- AES decryption (decrypt()) is executed **only** when encrypted fields (mobile, guardian_mobile, adhaar_no) are explicitly modified in the update request.
- Dramatically speeds up profile update request listing APIs.

#### 2. Direct Role Navigation on Login (src/components/LoginPanel.js)
- Replaced generic root redirects (/) with direct role routes (/student, /clerk, /admin).
- Eliminates server-side proxy redirect overhead and prevents UI freezing during login.

#### 3. Optimized Bootstrapping & Sequential Background Loading (src/context/ClerkContext.js)
- Drops global loading spinner (setLoading(false)) immediately after fetching basic clerk identity and college info.
- Fetches heavy secondary data tables (faculty data, pending profile requests, certificate requests, admission drafts, student history) sequentially in the background.
- Removed clerkData from useEffect dependencies, resolving infinite fetch loops and preventing state cleanup cancellations.

#### 4. Defensive Modification Rendering & Filtering (src/components/clerk/requests/StudentUpdateRequestsPanel.js)
- Wrapped search filtering in useMemo to eliminate unnecessary array re-filtering on renders.
- Added defensive parsing and fallback handling for 
ew_data (handling both JSON object modifications and plain string updates) without throwing React render errors.

---

### Commits Summary

| Commit | Author | Description |
|---|---|---|
| 24c5714 | GouthamA15 | **Performance & Login Fix:** Targeted decryption in student requests API, direct role routing in LoginPanel.js, useMemo filtering in StudentUpdateRequestsPanel.js, and ClerkContext.js infinite loop fix. |
| c52422f | GouthamA15 | **Profile Modification & Context Optimization:** Defensive 
ew_data parsing in request panel and sequential background table fetching in ClerkContext.js. |
| edd223b | P.Sannith | **CI/CD Network Fix:** Configured Docker Compose project name deployment_package to prevent 502 Bad Gateway on auto-deployments. |

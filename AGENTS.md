# KUCET College Management System - Repository Guidelines

**Last Updated:** May 14, 2026 (Session 110)

## Project Structure & Module Organization
- `src/app/`: Next.js App Router pages and API routes (`src/app/api/.../route.js`).
- `src/components/`: Shared React components (PascalCase file names).
- `src/context/`: Global state providers (StudentContext, ClerkContext, AdminContext, etc.).
- `src/lib/`: Server utilities (DB, auth, PDF, encryption, roll number, rate-limit, clock, etc.).
- `src/services/`: Business logic layer — static classes called by thin API routes ("Thin Route, Fat Service").
- `src/db/`: DB connection (`index.js`), Drizzle schema (`schema.js`), migration & maintenance scripts.
- `src/proxy.js`: Edge middleware — JWT auth verification, silent refresh, role-based redirects.
- `public/`: Static assets; local images preferred over Cloudinary for sub-100ms delivery.
- `drizzle/`: Drizzle Kit generated migration SQL files.
- `tests/`: Playwright E2E (`**/*.spec.js`) + Vitest unit (`tests/unit/**/*.test.js`).

## Build, Test, and Development Commands
- `npm run dev`: Start local dev server on `http://localhost:3000`.
- `npm run build`: Production build (also runs Sentry + PWA compilation).
- `npm run start`: Run production server from `.next`.
- `npm run lint`: Run ESLint (Next.js core-web-vitals config).
- `npm run test:unit`: Run Vitest unit tests (pattern: `tests/unit/**/*.test.js`).
- `npm run test:coverage`: Vitest with V8 coverage (threshold: 80% lines/functions/branches/statements).
- `npx playwright test`: Run Playwright E2E tests (requires `npm run build` + `npm run start` first or uses auto webServer).
  - Playwright config: `testMatch: '**/*.spec.js'`, `testIgnore: '**/unit/**'`, Chromium only, 2 retries on CI.
- DB commands: `db:generate` (drizzle-kit generate), `db:push` (drizzle-kit push), `db:migrate` (tsx migrate.js), `db:backup`, `db:prune`, `db:rotate-keys`, `db:archive`, `db:studio`.
- Pre-commit: Husky runs `npx lint-staged` which runs `eslint --fix` on staged `*.{js,jsx,ts,tsx}` files.

## Architecture & Conventions
- **Auth**: JWT via `jose` (HS256), HTTP-only cookies (`admin_auth`, `clerk_auth`, `student_auth`). Companion non-HTTP-only cookies: `clerk_logged_in`, `clerk_role`, `student_logged_in`. Verified in `src/proxy.js` (Edge middleware). Silent refresh via `/api/auth/refresh`.
- **Roles**: `student`, clerk sub-roles (`scholarship`, `admission`, `faculty`), `admin`. HOD is a boolean flag (`is_hod`) on clerks with faculty role.
- **DB**: MySQL via `mysql2/promise` pool + Drizzle ORM (`drizzle-orm`). Schema in `src/db/schema.js`. Connections use SSL/TLS when `DB_SSL=true` or host is `tidbcloud.com`. Serverless-optimized pool (connectionLimit: 15, idleTimeout: 30s).
- **Service Layer**: Business logic in `src/services/` (StudentService, FacultyService, HealthService). API routes should remain thin — delegate to service classes.
- **Context Caching**: Context providers (ClerkContext, StudentContext, AdminContext) cache fetched data; skip `setLoading(true)` if valid data exists in memory for sub-100ms page transitions.
- **Real-time**: Supabase Realtime Broadcast via `src/lib/sse.js` (channel: `kucet-updates`). No local SSE server. Clients listen via `RealtimeListener` component.
- **Time**: All business logic uses `getNow()` from `src/lib/clock.js` (always IST, UTC+5:30). Dev can mock time with `dev_mock_date` cookie when `NEXT_PUBLIC_WORKING_ENV=testing`.
- **Roll Numbers**: Parsed by `src/lib/rollNumber.js`. Format: `YY567TBBSS` (Regular) / `YY567BBSSL` (Lateral). Branch codes: 09=CSE, 30=CSD, 15=ECE, 12=EEE, 00=CIVIL, 18=IT, 03=MECH.
- **Sensitive Fields**: Mobile, Aadhaar use AES-256-GCM encryption (`src/lib/encryption.js`). Blind indexing via HMAC-SHA256 for search. ENCRYPTION_KEY must be 64-char hex.
- **Rate Limiting**: Upstash Redis (primary) + MySQL fallback (`src/lib/rate-limit.js`). IP-based for OTP endpoints.
- **Env Validation**: Zod schema in `src/lib/env.js`. Auto-validates on server import. Hard crash in production if invalid.
- **Logging**: `pino` with `pino-pretty` dev transport. Redacts emails, passwords, mobile, aadhaar.
- **Path aliases**: `@/` maps to `./src/*` (jsconfig.json). Use in all imports.
- **CSP**: Strict Content-Security-Policy in `next.config.mjs` — `connect-src` includes `*.supabase.co` and `wss://*.supabase.co`.
- **PWA**: Enabled via `@ducanh2912/next-pwa`, disabled in development. API routes excluded from service worker cache (denylist: `/^\/api\/.*$/`).
- **Sentry**: `@sentry/nextjs` configured with tunnel route `/monitoring`. Source maps hidden in production.
- **Overrides** in package.json: `mysql2@^3.16.0`, `postcss@^8.5.14`, `esbuild@^0.25.0`, `serialize-javascript@^7.0.5` — do not downgrade these.

## Coding Style
- JavaScript (no TypeScript), Next.js App Router, 2-space indent, semicolons.
- Files: `page.js` for routes, `route.js` for API endpoints, PascalCase for components.
- Names: Server actions and utilities use camelCase.

## Values & Constraints
- Roll number is the single source of truth — branch, academic type, and year are derived, never stored separately.
- Academic year is computed, not stored. Fee amounts are auto-calculated centrally.
- Clerk signatures and verification screenshots are required for certain workflows.
- AES-256-GCM encryption: ENCRYPTION_KEY must be exactly 64 hex characters. Rotating keys is a transactional DB operation (`npm run db:rotate-keys`).

## Testing Guidelines
- **Unit tests**: Vitest, in `tests/unit/**/*.test.js`. Mock Drizzle ORM and external integrations (Redis, Email). Service layer only (not API routes).
- **E2E tests**: Playwright, in `tests/**/*.spec.js`. Run against production build (`npm run build` + `npm run start`). Auth: inject mock cookies directly.
- **Load tests**: k6 script at `load-test-attendance.js` (manual run, not in CI).

## Security & Configuration
- Secrets in `.env.local` (gitignored). Required vars defined in `src/lib/env.js`.
- Auth cookies: HTTP-only, `sameSite: 'strict'`, `secure` in production. Companion cookies: `sameSite: 'lax'`, NOT httpOnly.
- Never commit `.env.local`, `.env.prod`, `.env.test`, `.vercel`.

---

# Technical Documentation

## 1. Project Overview
A robust, production-ready web application built with **Next.js** for managing the complete academic lifecycle at KUCET (Kakatiya University College of Engineering and Technology). The system supports four primary user roles: **Super Admin**, **Head of Department (HOD)**, **Clerk/Faculty**, and **Student**.

### Core Capabilities:
- **Departmental Management:** Multi-semester timetable orchestration, faculty workload tracking, and branch-specific syllabus management.
- **Real-Time Orchestration:** Instant schedule and activity synchronization via Server-Sent Events (SSE).
- **Admissions Management:** Multi-stage admission pipeline with draft verification and roll-number assignment
- **Student Records:** Comprehensive academic and personal information management
- **Attendance Tracking:** Proxy-free GPS-based attendance with session-wise records and calendar integration
- **Internal Marks:** Marks entry with validation, departmental pattern recommendations, and student visibility
- **Scholarship Management:** Government scholarship tracking and distribution workflows
- **Digital Certificates:** Automated generation of Bonafide, Transfer, No Objection, and Completion certificates
- **Fee Management:** Year-wise fee tracking with payment history and scholarship impact
- **Academic Calendar:** Institutional calendar with holidays and working day management
- **Database-Driven Syllabus:** Transitioned from hardcoded JS files to a normalized MySQL schema for curriculum management.
- **Web-First Architecture:** Transitioned from a Capacitor-based native mobile app to a pure Web/PWA architecture.

## 2. Technical Stack
- **Frontend:** Next.js 16.1.6, React 19.2.4, Tailwind CSS 4
- **Backend:** Next.js API Routes (App Router), Node.js
- **Mobile (Web):** Progressive Web App (PWA) with offline support and push notifications.
- **Database:** TiDB Cloud (MySQL-compatible Serverless), accessed via `mysql2/promise` with SSL/TLS enforcement. Integrated with **Drizzle ORM** for type-safe querying and versioned migrations.
- **Authentication:** JWT-based (HTTP-only cookies) using `jose` for edge-runtime compatibility. Includes native Google OAuth support via `next-auth` and `google-auth-library`.
- **Real-Time:** Supabase Realtime (WebSockets) for lightweight server-to-client broadcasting, with Redis Pub/Sub (`ioredis`) for distributed SSE.
- **Monitoring & Logging:** Sentry SDK for full-stack error tracking, `pino` for structured logging.
- **PDF & Document Generation:** `@react-pdf/renderer` 4.3.2 for certificates, `docxtemplater` for Word docs.
- **Cloud Storage:** Cloudinary SDK 2.9.0 for images, signatures, and backups.
- **Infrastructure & PWA:** `@ducanh2912/next-pwa` for offline capabilities, Upstash Redis for global rate limiting (`@upstash/ratelimit`).
- **Additional Libraries:**
  - `drizzle-orm` 0.45.1 - Type-safe ORM
  - `@supabase/supabase-js` 2.99.3 - Real-time Messaging Hub
  - `bcrypt` 6.0.0 - Password hashing
  - `zod` 4.3.6 - Schema validation
  - `react-hot-toast` 2.6.0 - Toast notifications
  - `react-datepicker` 9.1.0 - Date input components
  - `qrcode` 1.5.4 - QR code generation for certificates
  - `xlsx-js-style` 1.2.0 - Excel file handling
  - `mysqldump` 3.2.0 - Database backup utility

## 3. Core Architectural Concepts

### A. Database Integrity & Drizzle ORM
- **Source of Truth:** `src/db/schema.js` provides a centralized, code-first definition of the database structure.
- **Migrations:** Uses `drizzle-kit` for versioned migrations and schema synchronization (`db:push`, `db:generate`).
- **Type Safety:** Transitioning core API routes to Drizzle's query builder to eliminate raw SQL risks and improve maintainability.

### B. Middleware & Route Protection (`src/proxy.js`)
- **Technology:** Uses `jose` library for Edge-runtime compatible JWT verification.
- **Logic:** Intercepts requests to protected paths: `/admin`, `/clerk`, `/student`.
- **JWT Verification:** Decodes the HTTP-only cookie, verifies signature using `HS256`, and redirects unauthorized users.
- **Session Enrichment:** Tokens include `is_hod`, `branch`, and `academic_year` data to enable granular permissions.

### C. Global State Management (`src/context/`)
- **StudentContext**: Tracks profile status, pending certificate requests, and performance data.
- **ClerkContext**: Manages clerk profile and the `hodBranchData` (config, faculty load, timetable, branch subjects).
- **AdminContext**: System-wide statistics and clerk role management (HOD promotion).
- **FacultyAttendanceContext**: Specialized context for high-volume attendance entry caching.
- **AcademicsContext**: Caching layer for student academic performance and subjects.
- **AssetContext**: Centralized asset management and background pre-caching.

### D. Time Management & The "Time Machine"
- **Authoritative Clock:** `src/lib/clock.js` provides `getNow()` and `getNowSync()`.
- **Precision Travel:** Supports `datetime-local` input for travel to exact hours/minutes.
- **Consistency:** All business logic uses `getNow()` to respect mock time for testing semester transitions.

### E. Academic Intelligence (`src/lib/rollNumber.js`)
- **Regex-Based Parsing:** Decodes roll components (Entry year, Branch, Serial, Academic Type).
- **Dynamic Calculations:** Resolves Studying Year and Semester (1-8) based on date boundaries.

### F. College Configuration (`src/lib/college-config.js`)
- **Centralized Settings:** Single source of truth for semester start dates, fee structures, and category allotments.

### G. Real-Time Sync (Supabase)
- **Architecture:** Transitioned from local SSE to **Supabase Realtime (Broadcast)**.
- **The Radio Tower:** `src/lib/sse.js` sends events to Supabase via WebSocket hooks.
- **Global Reach:** Enables real-time sync on Serverless platforms (Vercel) where persistent connections are otherwise restricted.
- **Listeners:** `RealtimeListener` component allows UI to react instantly to server pings without refreshing.

### H. HOD & Branch Intelligence
- **Sub-Role Pattern:** HODs are elevated Faculty members with authority over a specific branch.
- **Departmental Authority:** HODs manage timetables, faculty load, and syllabus for their branch.

### I. Service Layer (Business Logic Modularization)
- **Architecture:** Transitioning complex logic from API routes (`src/app/api`) to a dedicated Service Layer (`src/services`).
- **Standard:** Services are static classes (e.g., `StudentService`, `FacultyService`) that handle database transactions, complex queries, and business rules.
- **Benefits:**
    - **Reusability:** Share logic between different API routes or server-side actions.
    - **Testability:** Decouples business rules from the Next.js request/response lifecycle.
    - **Readability:** API routes remain "thin," focusing only on authorization and request parsing.

## 4. Database Schema

### Core Identity & Authentication
- `students`: Core records (`roll_no`, `email`, `password_hash`).
- `clerks`: Administrative staff (`role`, `is_hod`, `branch`, `status`).
- `principal`: Principal/Admin accounts with `approval_signature`.
- `otp_codes` & `password_reset_tokens`: Security infrastructure.

### Student Personal & Academic Records
- `student_personal_details`: DOB, Aadhaar, address, identification marks, blood group.
- `student_academic_background`: Entrance exam, rank, SSC/Inter marks.
- `student_admission_drafts`: Applicant data before roll-number assignment.

### Academic & Attendance
- `college_info`: Institution-wide academic configuration.
- `academic_calendar`: Semester timelines and working day patterns.
- `student_attendance`: Multi-session tracking with `device_hash` and `ip_address` logs.
- `student_marks`: Internal marks with max-marks validation.

### Departmental & Scheduling
- `branch_config`: Branch-wide settings (Marks Pattern 20+10 vs 25+5, lock status).
- `branch_timetable`: Master schedule matrix (Day, Period 1-7, Subject, Faculty, Room).
- `faculty_subject_assignments`: Authoritative faculty-subject authorizations.

### Syllabus & Curriculum
- `syllabus_subjects`: Master course catalog.
- `syllabus_structure`: Branch-semester course mappings.

## 5. Specialized Modules & Features

### Head of Department (HOD) Console
- **Timetable Matrix:** Semester-aware grid (S1-S8) with "Duplicate Previous" productivity tools.
- **Workload Tracker:** Visual bar charts comparing faculty teaching intensity institution-wide.
- **Branch Analytics:** Condonation risk detection (75% threshold) with student-specific risk metrics.

### Proxy-Free Attendance System
- **Architecture:** GPS-based verification within 50m radius and secure 4-digit PINs.
- **Fingerprinting:** IP + User-Agent Lock prevents phone sharing and Incognito proxy attempts.

### Real-Time Activity Bars
- **Pulse Logic:** Both Students and Faculty see a "Live Session" bar detecting current room/subject.
- **Sync:** Updates from HOD timetable changes propagate instantly via Supabase.

### Digital Certificate Engine
- **Architecture:** Server-side PDF rendering using HMAC-SHA256 for tamper detection.

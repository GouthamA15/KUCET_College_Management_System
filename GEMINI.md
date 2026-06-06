# KUCET College Management System - Technical Documentation

**Last Updated:** June 6, 2026 (Session 147)

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

## 6. Recent Activity Log (May - June 2026)

#### **Session 147: Bonafide Lifecycle, Integrity Guard & Institutional Refactoring (June 6, 2026)**
- **Bonafide 'Pay Once' Logic**: Engineered a lifetime fee waiver system with strict course duration caps (4 for Regular, 3 for Lateral entry).
- **Universal Integrity Guard**: Integrated SHA-256 screenshot fingerprinting and global UTR uniqueness checks across both Fee Payments and Certificate Requests.
- **Redundancy Reduction**: Consolidated student record management into a unified `StudentService.upsertStudent` and centralized financial reporting in `FinanceService.getStudentFinancialSummary`.
- **Scholarship Service Layer**: Launched `ScholarshipService` to centralize institutional window logic and aggregate reporting metrics.
- **API Orchestration**: Refactored high-stakes Clerk APIs (Profile, Search, Summary) to use `wrapHandler` for centralized auth, validation, and telemetry.
- **Quality Assurance**: Achieved >80% global branch coverage (verified via `test:coverage`) with new dedicated test suites for Finance and Scholarship services.
- **Time-Travel Synchronization**: Hardened all certificate and financial timestamps to respect the authoritative IST mock clock (`getNow()`).

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

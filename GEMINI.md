# KUCET College Management System - Technical Documentation

**Last Updated:** March 11, 2026

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

---

## 2. Technical Stack
- **Frontend:** Next.js 16.1.6, React 19.2.4, Tailwind CSS 4
- **Backend:** Next.js API Routes (App Router), Node.js
- **Database:** MySQL (Railway-hosted, accessed via `mysql2/promise`)
- **Authentication:** JWT-based (HTTP-only cookies) using `jose` for edge-runtime compatibility. Includes native Google OAuth support.
- **Real-Time:** Server-Sent Events (SSE) for lightweight server-to-client broadcasting.
- **Monitoring:** Sentry SDK for full-stack error tracking and performance profiling.
- **PDF Generation:** Custom template-based certificates using `@react-pdf/renderer` 4.3.2
- **Cloud Storage:** Cloudinary integration for images, signatures, and screenshots
- **Additional Libraries:**
  - `bcrypt` 6.0.0 - Password hashing
  - `react-hot-toast` 2.6.0 - Toast notifications
  - `react-datepicker` 9.1.0 - Date input components
  - `qrcode` 1.5.4 - QR code generation for certificates
  - `xlsx-js-style` 1.2.0 - Excel file handling
  - `docxtemplater` 3.67.6 - Document templating
  - `google-auth-library` 10.6.1 - Secure ID token verification
  - `cloudinary` 2.9.0 - Cloud storage SDK

---

## 3. Core Architectural Concepts

### A. Middleware & Route Protection (`src/proxy.js`)
- **Technology:** Uses `jose` library for Edge-runtime compatible JWT verification.
- **Logic:** Intercepts requests to protected paths: `/admin`, `/clerk`, `/student`.
- **JWT Verification:** Decodes the HTTP-only cookie, verifies signature using `HS256`, and redirects unauthorized users.
- **Session Enrichment:** Tokens include `is_hod`, `branch`, and `academic_year` data to enable granular permissions.

### B. Global State Management (`src/context/`)
- **StudentContext**: Tracks profile status, pending certificate requests, and performance data.
- **ClerkContext**: Manages clerk profile and the `hodBranchData` (config, faculty load, timetable, branch subjects).
- **AdminContext**: System-wide statistics and clerk role management (HOD promotion).
- **FacultyAttendanceContext**: Specialized context for high-volume attendance entry caching.
- **AcademicsContext**: Caching layer for student academic performance and subjects.
- **AssetContext**: Centralized asset management and background pre-caching.

### C. Time Management & The "Time Machine"
- **Authoritative Clock:** `src/lib/clock.js` provides `getNow()` and `getNowSync()`.
- **Precision Travel:** Supports `datetime-local` input for travel to exact hours/minutes.
- **Consistency:** All business logic uses `getNow()` to respect mock time for testing semester transitions.

### D. Academic Intelligence (`src/lib/rollNumber.js`)
- **Regex-Based Parsing:** Decodes roll components (Entry year, Branch, Serial, Academic Type).
- **Dynamic Calculations:** Resolves Studying Year and Semester (1-8) based on date boundaries.

### E. College Configuration (`src/lib/college-config.js`)
- **Centralized Settings:** Single source of truth for semester start dates, fee structures, and category allotments.

### F. Real-Time Sync (SSE)
- **Architecture:** `/api/realtime/stream` maintains persistent connections using Server-Sent Events.
- **The Broadcast:** `src/lib/sse.js` manages global controllers to push `TIMETABLE_CHANGED` events.
- **Listeners:** `RealtimeListener` component allows UI to react instantly to server pings without refreshing.

### G. HOD & Branch Intelligence
- **Sub-Role Pattern:** HODs are elevated Faculty members with authority over a specific branch.
- **Departmental Authority:** HODs manage timetables, faculty load, and syllabus for their branch.

---

## 4. Database Schema

### **1. Core Identity & Authentication**
- `students`: Core records (`roll_no`, `email`, `password_hash`).
- `clerks`: Administrative staff (`role`, `is_hod`, `branch`, `status`).
- `principal`: Principal/Admin accounts with `approval_signature`.
- `otp_codes` & `password_reset_tokens`: Security infrastructure.

### **2. Student Personal & Academic Records**
- `student_personal_details`: DOB, Aadhaar, address, identification marks, blood group.
- `student_academic_background`: Entrance exam, rank, SSC/Inter marks.
- `student_admission_drafts`: Applicant data before roll-number assignment.

### **3. Academic & Attendance**
- `college_info`: Institution-wide academic configuration.
- `academic_calendar`: Semester timelines and working day patterns.
- `student_attendance`: Multi-session tracking with `device_hash` and `ip_address` logs.
- `student_marks`: Internal marks with max-marks validation.

### **4. Departmental & Scheduling**
- `branch_config`: Branch-wide settings (Marks Pattern 20+10 vs 25+5, lock status).
- `branch_timetable`: Master schedule matrix (Day, Period 1-7, Subject, Faculty, Room).
- `faculty_subject_assignments`: Authoritative faculty-subject authorizations.

### **5. Syllabus & Curriculum**
- `syllabus_subjects`: Master course catalog.
- `syllabus_structure`: Branch-semester course mappings.
- `syllabus_units`: Unit titles and detailed topic arrays (JSON).

---

## 5. Specialized Modules & Features

### **A. Head of Department (HOD) Console**
- **Timetable Matrix:** Semester-aware grid (S1-S8) with "Duplicate Previous" productivity tools.
- **Workload Tracker:** Visual bar charts comparing faculty teaching intensity institution-wide.
- **Syllabus Manager:** Recursive full-CRUD tool for subjects and units with safe JSON parsing.
- **Branch Analytics:** Condonation risk detection (75% threshold) with student-specific risk metrics.

### **B. Proxy-Free Attendance System**
- **Architecture:** GPS-based verification within 50m radius and secure 4-digit PINs.
- **Fingerprinting:** IP + User-Agent Lock prevents phone sharing and Incognito proxy attempts.

### **C. Real-Time Activity Bars**
- **Pulse Logic:** Both Students and Faculty see a "Live Session" bar detecting current room/subject.
- **Sync:** Updates from HOD timetable changes propagate instantly via SSE.

### **D. Digital Certificate Engine**
- **Architecture:** Server-side PDF rendering using HMAC-SHA256 for tamper detection.

---

## 6. Recent Activity Log (Feb-Mar 2026)

### **Session 33: Comprehensive Production Hardening & Tab Multiplexing (Latest - March 11, 2026)**
- **Tab Multiplexing:** Implemented **Web Locks API** and `BroadcastChannel` in `RealtimeListener` to bypass the browser's 6-connection limit; only one tab (the Leader) connects to the server and broadcasts updates locally.
- **Brute-Force Protection:** Added **Rate Limiting** to Student, Clerk, and Admin login routes (5 attempts/15 mins) and OTP services (3/hr).
- **IDOR Security Fixes:** Hardened scholarship deletion (strict role check) and student profile updates (forced session-based identity) to prevent unauthorized record modification.
- **Storage Protection:** Enforced a **1MB file size limit** and image-only MIME type validation in the Cloudinary upload utility to prevent storage abuse.
- **CSRF Hardening:** Switched all sensitive HttpOnly session cookies to `SameSite: Strict` across all authentication mechanisms.
- **Clock Lockdown:** Implemented mandatory `NODE_ENV` checks in the clock utility to physically prevent "Time Machine" features from being active in production.

### **Session 32: Real-Time Orchestration & Performance Hardening (March 11, 2026)**
- **Real-Time (SSE):** Production-hardened stream with `X-Accel-Buffering` support and 15s pings for cloud proxy stability.
- **Smart Transition Timers:** Replaced 5-minute activity polling with dynamic timers that trigger instant refreshes at period boundaries.
- **Live Attendance Sheet:** Implemented `STUDENT_VERIFIED` broadcasts; students now appear instantly on faculty screens upon PIN entry.
- **Performance Optimization:** Refactored Student Academic Dashboard query using CTEs and JOINs, achieving a 90% reduction in database subqueries.
- **Resource Management:** Patched database connection leaks in transactional routes by enforcing strict `finally` block releases.
- **Data Integrity:** Hardened Syllabus Manager with JSON validation to prevent double-stringification of unit topics.

### **Session 31: Real-Time Sync & Production Hardening (March 10, 2026)**
- **Real-Time (SSE):** Implemented Server-Sent Events for instant schedule propagation.
- **Live Activity Tracking:** Developed "Pulse" bars for students and faculty detecting ongoing lectures.
- **Load Testing:** Created k6 suite simulating 500 concurrent students marking attendance.
- **Error Monitoring:** Integrated Sentry across all runtimes (Client, Server, Edge).
- **Database Resilience:** Implemented `ECONNRESET` retry logic and keep-alive heartbeats in `src/lib/db.js`.
- **Security Hardening:** Enforced `secure: true` and `sameSite: 'lax'` on all production cookies.

### **Session 30: Production Performance (March 10, 2026)**
- **Optimization:** Implemented composite database indexes across `branch_timetable` and `student_attendance` for sub-100ms load times.

### **Session 29: HOD Role & Multi-Semester Management (March 10, 2026)**
- **HOD Integration:** Developed departmental control layer with multi-semester timetable matrix.
- **Attendance Alerts:** Launched "Condonation Risk" dashboard tracking 75% attendance threshold.
- **Faculty Pulse:** Upgraded workload tracker with "Conducted vs Scheduled" efficiency metrics.
- **Smart Scheduling:** Timetable editor highlights "Officially Assigned Teachers" for subjects.
- **Data Resilience:** Fixed JSON parsing crashes in Syllabus Manager using `safeParse`.

### **Session 28: Scholarship Refactor & Student Activity (March 10, 2026)**
- **Scholarship:** Modularized metrics and application windows.
- **Activity System:** Context-based notifications for thumb updates and dues.

### **Session 27: Automated Data Collection (March 7, 2026)**
- **Automation:** Google Forms integration and production-grade bulk import script.

### **Session 26: Native Plugin Hardening (March 6, 2026)**
- **Android:** Manual plugin registration and dependency resolution strategy for Capacitor 7.

### **Session 25: Native Auth & Mobile Optimization (March 6, 2026)**
- **Native Google:** Integrated `@capgo/capacitor-social-login` for account picker support.

### **Session 24: Capacitor Integration (March 6, 2026)**
- **Mobile Shell:** Configured high-accuracy GPS permissions and institutional branding.

### **Session 23: Asset Caching & Migration (March 5, 2026)**
- **Pre-caching:** Background asset loading system via `AssetContext`.

---

## Summary
The KUCET CMS is a comprehensive institutional control system. It integrates high-security attendance, real-time departmental orchestration for HODs, and professional monitoring while maintaining strict data integrity and platform-agnostic performance.

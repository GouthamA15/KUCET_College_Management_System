# KUCET College Management System - Technical Documentation

**Last Updated:** March 15, 2026

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

### **Session 37: Student Security Hardening, Verification Workflows & Formal UI Redesign (Latest - March 15, 2026)**
- **Redirection Logic:** Refactored `src/proxy.js` to intelligently route students: verified students go directly to `/student/profile`, while unverified students are guided to the `/student` dashboard for account setup.
- **Security Middleware:** Implemented strict middleware enforcement to block unverified students (no email verification or password set) from accessing sensitive academic and request pages, limiting them to Home, Security, and Profile view.
- **API Architectural Fix:** Permanently resolved the "Unexpected token <" JSON parsing error by ensuring the proxy returns proper `401 Unauthorized` JSON responses for API routes instead of HTML redirects during session expiration.
- **Institutional UI Overhaul:**
    - **Unified Dashboard:** Redesigned the Student Home page into a formal, single-card institutional layout with high-density data grids and professional `#0b3578` branding.
    - **Formal Matrix:** Replaced the modern timetable cards with a structured, high-density departmental class matrix featuring sharp borders and administrative labeling.
    - **Record Control Portal:** Transformed Profile Edit and Update History pages into authoritative modification portals with timestamped audit logs.
    - **Clerk Verification Hub:** Upgraded the Student Requests page for clerks with a professional audit layout and **side-by-side comparison** of current College Records vs. Student Requests.
- **Branding & Assets:** 
    - Restored the institutional loading screen with the official college logo and a formal "Loading student dashboard" message.
    - Integrated the official campus image into the high-level transactional email template.
- **UI/UX Polishing:**
    - Fixed a "Rules of Hooks" violation in the `Navbar` by refactoring context usage to top-level `useContext` calls.
    - Simplified academic period displays to a clean "Year X / Semester Y" format.
    - Resolved a JSX rendering bug that caused a stray "0" to appear on the Student Home page.
    - Standardized OTP error messages to "Please try again after 15 minutes" across frontend and backend.
- **Email Reliability:** Increased OTP rate limits to 5 requests per 15 minutes to balance security with user convenience during testing.

### **Session 36: Profile Update Requests, Admission Form Hardening & UI Refinement (March 13, 2026)**
- **Database Security:** Implemented SSL/TLS support in `src/lib/db.js` to enable secure connections for production databases like TiDB Cloud. The system now automatically detects cloud hosts and enforces encrypted transport.
- **Request Unit (RU) Optimization:** Refactored the live "Activity Bar" polling logic for both students and faculty. Replaced recursive `setTimeout` logic with stable intervals and transition-window detection, preventing potential "Infinite Loop" bugs and significantly reducing unnecessary database queries to preserve TiDB Cloud free-tier quotas.
- **Student Profile Control:** Transformed the student Edit Profile page into a comprehensive record management interface. Students can now view all details (Personal, Academic, Student) and request updates for any field.
- **Request-Based System:** Implemented a mandatory "Verification Proof" (image upload) for any data updates. All changes (text data, profile photo, or signature) now flow through a centralized `student_profile_requests` table for clerk approval.
- **Clerk Verification Interface:** Upgraded the Admission Clerk's request dashboard to display "OLD vs NEW" data comparisons and verification proofs, enabling one-click approval or rejection with reason.
- **UI Layout Refinement:** Relocated the Verification Proof section to the bottom of the student edit profile form for better UX flow, keeping the sidebar focused on primary identity assets (photo/signature).
- **Broken Image Fallback:** Implemented `FallbackImage` component in profile update history to gracefully handle deleted images from Cloudinary (e.g., from rejected requests), replacing broken links with neat "Image Deleted" placeholders.
- **Admission Form:** Hardened the admission process by making `Seat Allotted Category`, `Religion`, and `Mother Tongue` mandatory fields. Verified `Father's Occupation` remains optional. Added backend validation to enforce these rules.
- **Blood Group Utility:** Expanded global `COLLEGE_CONFIG` to include "Not available" as a valid blood group option.
- **Scholarship Dashboard:** Improved UX and implemented a new search feature allowing clerks to find student scholarship records by name. Enhanced year record cards and metrics display for better clarity.
- **UI Performance:** Resolved a Next.js deprecation warning in the `Hero` component by migrating from `onLoadingComplete` to the `onLoad` property for optimized image handling.
- **Navbar & Navigation:** Resolved logic conflicts between scholarship and admission clerk navbar options. Fixed minor logout issues and navbar rendering bugs.
- **API Enhancements:** Standardized scholarship API responses and implemented a new search-by-name endpoint (`/api/clerk/scholarship/search-by-name`) to support advanced filtering.
- **Stability:** Fixed auto-merge failures and resolved minor UI issues in clerk settings (profile/security) and department management pages.

### **Session 35: Final Production Optimizations (March 11, 2026)**
- **Security Headers:** Implemented standard production security headers in `next.config.mjs`, including HSTS, No-Sniff, Frame-Options (DENY), and XSS-Protection to harden the application against common web attacks.
- **Database Scalability:** Increased the MySQL connection pool limit from 10 to **25** to support higher concurrent traffic from students and faculty during peak hours.
- **Permission Hardening:** Verified and enforced minimal-data-leakage principles in authenticated `me` routes, ensuring only necessary session data is exposed to the client.

### **Session 34: Institutional Synchronization & Security Hardening (March 11, 2026)**
- **Timezone Enforcement:** Hardened the clock utility to strictly enforce **IST (UTC+5:30)** across the server and client. This resolves a critical 5.5-hour mismatch on UTC servers (Render/Railway), ensuring "Live Session" bars and attendance windows are perfectly synchronized with college hours.
- **Login Enumeration Protection:** Switched Student Login to use generic "Invalid credentials" error messages. This prevents attackers from identifying valid roll numbers or discovering whether a student has set a custom password.
- **GPS Reliability:** Softened the geofencing accuracy check to allow high-precision devices (accuracy < 1m) while maintaining strict blocks for 0-accuracy readings (often associated with mock location failures). Added server-side logging for low-accuracy attempts to assist in administrative troubleshooting.

### **Session 33: Comprehensive Production Hardening & Tab Multiplexing (March 11, 2026)**
- **Tab Multiplexing:** Implemented **Web Locks API** and `BroadcastChannel` in `RealtimeListener` to bypass the browser's 6-connection limit; only one tab (the Leader) connects to the server and broadcasts updates locally.
- **Brute-Force Protection:** Added **Rate Limiting** to Student, Clerk, and Admin login routes (5 attempts/15 mins) and OTP services (3/hr).
- **IDOR & Data Integrity:** Implement ACID transactions for admission finalization and manual student creation to prevent orphaned records. Hardened scholarship deletion (strict role check) and student profile updates (forced session-based identity).
- **Privacy Hardening:** Audited and removed sensitive payload logging (Aadhaar, mobile, emails) in production API routes to ensure data privacy and compliance.
- **Storage Protection:** Enforced a **1MB file size limit** and image-only MIME type validation in the Cloudinary upload utility. Added client-side UI validation for Profile Photos, Signatures, and Payment Screenshots to ensure immediate user feedback and prevent server errors.
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

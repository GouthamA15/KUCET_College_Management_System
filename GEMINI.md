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

### **Session 38: Unified Sidebar Navigation, Institutional UI Overhaul & Responsive Architecture (Current - March 15, 2026)**
- **Modern Responsive Navigation:**
    - **Rail Sidebar:** Implemented a hover-expandable rail sidebar for desktop that preserves operational space.
    - **Mobile Drawer:** Developed a slide-over mobile drawer triggered by a hamburger menu, providing a zero-waste workspace on small screens.
    - **Personalized Header:** Integrated student identity (PFP and Name) into the sidebar for a premium "User Hub" feel.
    - **Sticky Controls:** Fixed the `StudentTopBar` and `ClerkTopBar` at the top of the viewport on mobile for persistent access to search and notifications.
- **Institutional Dashboard Redesign:**
    - **Sophisticated Aesthetic:** Switched to a lightweight, "Institutional Executive" UI with refined Inter-style typography, softer borders, and subtle shadows.
    - **Action Center:** Implemented a prioritized "Priority Actions" banner system for critical scholarship and security alerts.
    - **Functional Inbox:** Transformed the notification bell into a functional dropdown with "View details" and dismissal logic for certificate status updates.
- **Clerk & Faculty Modernization:**
    - **Sidebar Parity:** Mirrored the student navigation logic for all employee pages, supporting Admission, Scholarship, and Faculty roles.
    - **Professional Iconography:** Replaced emojis with a custom-designed SVG icon set for all departmental and administrative links.
    - **Identity Visibility:** Enabled persistent visibility of employee name and role on mobile top bars.
- **Structural Cleanup:**
    - **Dedicated Finances:** Migrated the "Fees and Scholarship" section to a dedicated `/student/finances` page, streamlining the profile view.
    - **Modular Layouts:** Removed redundant `Header`, `Navbar`, and `Footer` calls from over 30 individual pages, centralizing navigation logic in unified layout files.
    - **Precision Finance:** Updated the dashboard to show **Pending Dues** only for the current academic session, matching official college audit logic.
- **Profile Refinements:**
    - **Direct Edit Access:** Added a surgical "Edit" icon in the profile header for immediate record modification.
    - **Dynamic PFP:** Enabled real-time profile picture rendering in top bars using actual student/employee data.

### **Session 37: Student Security Hardening, Verification Workflows & Formal UI Redesign (March 15, 2026)**
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
... (rest of history)

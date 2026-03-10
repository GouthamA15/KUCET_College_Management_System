# KUCET College Management System - Technical Documentation

**Last Updated:** March 10, 2026

## 1. Project Overview
A robust, production-ready web application built with **Next.js** for managing the complete academic lifecycle at KUCET (Kakatiya University College of Engineering and Technology). The system supports four primary user roles: **Super Admin**, **Head of Department (HOD)**, **Clerk/Faculty**, and **Student**. 

### Core Capabilities:
- **Departmental Management:** Multi-semester timetable orchestration, faculty workload tracking, and branch-specific syllabus management.
- **Admissions Management:** Multi-stage admission pipeline with draft verification and roll-number assignment
- **Student Records:** Comprehensive academic and personal information management
- **Attendance Tracking:** Faculty-driven attendance with session-wise records and calendar integration
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
- **PDF Generation:** Custom template-based certificates using `@react-pdf/renderer` 4.3.2
- **Cloud Storage:** Cloudinary integration for images, signatures, and screenshots
- **Additional Libraries:**
  - `bcrypt` 6.0.0 - Password hashing
  - `react-hot-toast` 2.6.0 - Toast notifications
  - `react-datepicker` 9.1.0 - Date input components
  - `qrcode` 1.5.4 - QR code generation for certificates
  - `xlsx-js-style` 1.2.0 - Excel file handling
  - `docxtemplater` 3.67.6 - Document templating (future use)
  - `next-auth` 4.24.13 - Authentication support
  - `js-cookie` 3.0.5 - Cookie management
  - `google-auth-library` 9.15.1 - Secure ID token verification
  - `cloudinary` 2.5.1 - Cloud storage SDK

---

## 3. Core Architectural Concepts

### A. HOD & Branch Intelligence (New)
**Architecture:**
- **Sub-Role Pattern:** HODs are elevated Faculty members identified by `is_hod = 1` and a designated `branch` in the `clerks` table.
- **Departmental Authority:** HODs manage the entire academic lifecycle for their specific branch, including:
    - **Multi-Semester Timetables:** Independent 7-period daily schedules for S1 through S8.
    - **Faculty Workload Tracker:** Real-time visualization of weekly teaching intensity.
    - **Marks Pattern Configuration:** Enforcing branch-wide internal marks schemas (20+10 vs 25+5).
    - **Syllabus Orchestration:** Full control over subject registration and detailed unit topics.
    - **Smart Assignment:** Linking official faculty-subject authorizations directly into the scheduling matrix.

### B. Middleware & Route Protection (`src/proxy.js`)
- **Technology:** Uses `jose` library for Edge-runtime compatible JWT verification (replacing standard `jsonwebtoken` which fails in edge middleware).
- **Logic:** Intercepts requests to protected paths:
  - `/admin` - Super Admin routes (principals, key administrators)
  - `/clerk` - Administrative clerk routes (admission, scholarship, faculty management)
  - `/student` - Student self-service routes (profile, attendance, marks, certificates)
- **JWT Verification:** Decodes the HTTP-only cookie, verifies signature using `HS256`, and redirects unauthorized users to `/`.
- **Session Enrichment:** Tokens now include `is_hod` and `branch` data to enable sub-role permissions without redundant DB hits.
- **Sub-Role Enforcement:** Clerk routes are further guarded by role:
  - `role: 'admission'` - Admission draft verification and roll-number assignment
  - `role: 'scholarship'` - Scholarship record management and approval
  - `role: 'faculty'` - Attendance entry and marks management
- **Cookie-Based Auth:** Server sets three cookie types: `admin_auth`, `clerk_auth`, `student_auth` (all HTTP-only)

### C. Global State Management (`src/context/`)
- **StudentContext** (`src/context/StudentContext.js`): Tracks student profile status, pending certificate requests, and academic performance data
- **ClerkContext** (`src/context/ClerkContext.js`): Manages clerk profile, role assignment, and pending tasks (admissions to verify, scholarship records to process). Includes the new `hodBranchData` (config, faculty load, timetable, branch subjects, official assignments).
- **AdminContext** (`src/context/AdminContext.js`): Provides system-wide statistics, pending approvals, and administrative control state
- **FacultyAttendanceContext** (`src/context/FacultyAttendanceContext.js`): Specialized context for attendance data fetching and caching during high-volume entry
- **AcademicsContext** (`src/context/AcademicsContext.js`): Caching layer for student academic performance, subjects, and marks
- **AssetContext** (`src/context/AssetContext.js`): Centralized asset management and pre-caching layer.

### D. Time Management & The "Time Machine"
- **Authoritative Clock:** `src/lib/clock.js` provides:
  - `getNow()` - Async server-side time retrieval
  - `getNowSync()` - Synchronous client-side time (for UI logic)
- **Institutional Schedule:** Strictly enforced 7-period daily matrix:
    - **P1-P2:** 09:30 - 11:10
    - **Short Break:** 11:10 - 11:20
    - **P3-P4:** 11:20 - 01:00
    - **Lunch:** 01:00 - 02:00
    - **P5-P7:** 02:00 - 04:30
- **Mock Time Support:** In testing environment (`NEXT_PUBLIC_WORKING_ENV=testing`), can set `dev_mock_date` cookie to simulate different dates
- **Dev Tool:** `/dev/time-machine` page allows developers to mock system date for testing:
  - Semester transitions
  - Academic year rollovers
- **Consistency:** All business logic uses `getNow()` instead of `new Date()` to respect mock time

### E. Academic Intelligence (`src/lib/rollNumber.js`)
- **Regex-Based Parsing:** Decodes roll number components using institutional patterns:
  - **Regular:** `/^(\d{2})567T(\d{2})(\d{2})$/` (e.g., `23567T0901`)
  - **Lateral:** `/^(\d{2})567(\d{2})(\d{2})L$/` (e.g., `23567001L`)
- **Components Extracted:**
  - `YY` (first 2 digits) → Entry year (20YY)
  - Branch code (3 digits) → CSE, ECE, EEE, MECH, CIVIL, CSD, IT
  - Serial number (2 digits) → Student sequence (01-99)
  - `T` vs `L` suffix → Academic type (Regular vs Lateral)
- **Dynamic Calculations:**
  - Academic year duration (Regular: 4 years, Lateral: 3 years)
  - Current studying year based on entry date and current date
  - Effective academic year (considers semester start date from college config)
  - Semester calculation with admission type consideration
  - `getCurrentSemester` - Dynamically resolves the current academic semester based on date boundaries

### F. College Configuration (`src/lib/college-config.js`)
- **Centralized Settings:**
  - `COLLEGE_CONFIG` object stores:
    - Semester start month and day
    - Fee structure by branch (Self-Finance vs Non-Self-Finance)
    - Blood group options
    - Scholarship categories
    - Category allotment information
- **Usage:** All APIs and UI components reference this single source of truth
- **Benefit:** Changes to college policies don't require code changes, only config updates

### G. Academic Calendar System
- **Database-Driven:** Clerks define holiday and working day patterns per semester
- **Impact Areas:**
  - Attendance entry restricted to WORKING days only
  - Faculty receives visual feedback when trying to mark on non-working days
  - Semester closure prevents retroactive attendance/marks entry
- **Tables:**
  - `academic_calendar` - Semester metadata and working day tracking
  - `calendar_holidays` - Explicit holiday dates within semesters

### H. Database-Driven Curriculum System
**Architecture:**
- **Normalized Schema**: Replaced the legacy `lib/syllabus` folder with three dedicated tables:
    - `syllabus_subjects`: Master list of all unique subjects and their types.
    - `syllabus_structure`: Maps subjects to branches and semesters, including support for elective groups (Professional/Open Electives).
    - `syllabus_units`: Stores unit titles and detailed topic arrays as JSON.
- **HOD Control**: Department heads now have full CRUD control over their branch's syllabus via the HOD Console.
- **Dynamic Reconstruction**: Backend APIs reconstruct the nested elective/variant hierarchy on-the-fly, ensuring compatibility with existing frontend components.
- **Leaf-Node API**: The student academic info API filters for leaf subjects (`is_group = 0`), ensuring students see their specific elective choices (e.g., "Artificial Intelligence") instead of generic group titles.

---

## 4. Database Schema

### **1. Core Identity & Authentication**
- `students` - Core student records
  - `roll_no` (PK), `email`, `password_hash`
  - `created_at`, `updated_at` - Audit timestamps
- `clerks` - Administrative staff
  - `id` (PK), `email`, `password_hash`
  - `role` ENUM('admission', 'scholarship', 'faculty')
  - `is_hod` (TINYINT), `branch` (VARCHAR)
  - `status` ENUM('active', 'inactive')
- `principal` - Principal/Admin accounts
  - `id`, `email`, `password_hash`, `approval_signature` (BLOB)
- `otp_codes` - One-time passwords for password reset flow
- `password_reset_tokens` - Token-based password recovery
- `rate_limits` - Database-backed rate limiting for APIs (IP and user-based)

### **2. Student Personal & Academic Records**
- `student_personal_details` - Extended student information
  - `roll_no` (FK to students), Name, DOB, gender, blood group, Aadhaar, address, identification marks, caste category.
- `student_academic_background` - Entrance exam and prior education
  - `roll_no` (FK), `entrance_exam`, `rank`, `marks`, `ssc_marks`, `inter_marks`, `seat_allotted`.
- `student_admission_drafts` - Pre-enrollment applicant data
  - Temporary storage before roll-number assignment.
- `student_images` - Profile photographs (VARCHAR for Cloudinary URL)
- `student_signatures` - Digital signatures (VARCHAR for Cloudinary URL)

### **3. Academic & Attendance**
- `college_info` - Institution-wide academic configuration.
- `academic_calendar` - Semester timelines.
- `student_attendance` - Multi-session daily tracking.
- `student_marks` - Internal examination marks.
- `faculty_interests` - Faculty subject preferences.
- `attendance_sessions` - Active secure attendance tracking.
- `attendance_session_logs` - Real-time student verification logs.
  - Tracks `device_hash`, `ip_address`, and `ua_hash` to prevent phone sharing and proxy attempts.

### **4. Departmental Configuration (New)**
- `branch_config`: `branch`, `academic_year`, `semester`, `mid_max` (20 or 25), `assignment_max`.
- `branch_timetable`: `branch`, `semester`, `day_of_week`, `period_number`, `subject_code`, `faculty_id`, `room_no`.
- `faculty_subject_assignments`: `faculty_id`, `subject_code`, `subject_name`, `branch`, `course_semester`, `is_active`.

### **5. Student Requests & Records**
- `student_profile_requests` - photo/signature update approvals.
- `certificate_requests` - Certificate generation pipeline.

### **6. Finance & Scholarship**
- `student_fee_payments` - Tuition transaction history.
- `scholarship_sanctions` - Government scholarship records.

### **7. Syllabus & Curriculum**
- `syllabus_subjects`: `subject_code` (PK), `subject_name`, `subject_type` (ENUM).
- `syllabus_structure`: `branch`, `semester`, `subject_code` (FK), `is_group`, `parent_group_code`.
- `syllabus_units`: `subject_code` (FK), `unit_order`, `unit_name`, `topics` (JSON).

### **8. Support Tables**
- `syllabus_mapping` - Branch-wise course catalog.
- `roles`, `audit_logs` (future).

---

## 5. Specialized Modules & Features

### **A. Head of Department (HOD) Console**
**Implementation:** `src/components/clerk/faculty/HODConsole.js`
- **Matrix Editor:** Interactive timetable grid supporting independent schedules for S1 through S8. Features a "Duplicate" tool for rapid entry.
- **Workload Tracker:** Visual bar charts comparing faculty teaching intensity based on weekly periods. Aggregates data institution-wide.
- **Syllabus Manager:** Recursive full-CRUD tool for subjects and unit topics with safe JSON parsing logic for malformed data resilience.
- **Subject Authorization:** Functional tab to officially assign faculty to departmental subjects, populating the core assignments ledger.
- **Departmental Config:** Global switch for branch-wide marks patterns (20+10 vs 25+5).

### **B. Digital Certificate Engine** (`src/pdf/` & `src/app/api/.../certificate`)
**Architecture:**
- Server-side rendering using `@react-pdf/renderer` v4.3.2.
- Security: Certificate ID generated as `HMAC-SHA256(roll_no + type)` for tamper detection.
- Base64 asset encoding to prevent file access errors.

**Supported Certificate Templates:**
- Bonafide, Transfer, No Objection (NOC), Completion.

**Request Workflow:**
1. Student initiates request via `/student/profile`.
2. Request stored in `certificate_requests` table.
3. Clerk approves from admin dashboard.
4. API generates PDF and calculates Certificate ID.
5. Student downloads from profile or verification portal.

**PDF Rendering Details:**
- Modular Design: `BaseCertificate.js`, `QRBlock.js`, `SignatureBlock.js`.
- Asset Handling: Base64 embedding for logo and signatures.

### **C. Proxy-Free Attendance System**
**Architecture:**
- **Secure PIN + GPS:** Faculty starts a 10-minute session generating a cryptographically secure 4-digit PIN.
- **Geofencing:** Verification strictly enforced within a **50-meter radius**.
- **High-Accuracy Requirements:** Frontend enforces `enableHighAccuracy: true`.
- **Device Fingerprinting:** Persistent browser-based UUID (`localStorage`) blocks multiple roll numbers per session.
- **Cross-Browser Proxy Prevention:** The server enforces an **IP + User-Agent Lock**. Even if a student uses Incognito mode or a different browser (wiping the UUID), the server detects the identical network signature and browser footprint, blocking subsequent verification attempts for different roll numbers.
- **Anti-Spoofing:** System rejects "Mock Location" apps (accuracy <= 1).
- **Auto-Sync & Finalization:** "Confirm All" marks verified students as PRESENT; sessions close upon saving.

### **D. Faculty Attendance & Marks System**
**Attendance Entry Modes:**
1. **Excel Mode** - High-performance grid for bulk entry with "Follow Previous Session" feature.
2. **Mobile View** - Card-based responsive layout with progressive session unlocking.

**Marks Entry Features:**
- Subject-wise marks recording with validation against subject maximum.
- **Department Recommendations:** Faculty see a **"RECOMMENDED"** badge on the marks pattern selected by their HOD.
- **Lab Evaluation Fix:** Explicit mapping for Execution (`mid1_marks`), Writing (`mid2_marks`), and Record (`assignment_marks`) marks.

### **E. Cloudinary Optimization & Migration**
**Architecture:**
- All binary media migrated from MySQL BLOBs to **Cloudinary**.
- **Image Proxying:** API routes proxy images to solve `next/image` CORS issues.
- **Storage Alerts:** Monitoring API sends email alerts when usage reaches 20GB.
- **Concurrency-Optimized Migration Tools:**
    - `fetch_all_cloudinary_assets.js`: Full-library backup tool with 15 parallel download streams.
    - `migrate_to_new_cloudinary.js`: Recursive account migration script with 10 parallel upload streams and incremental skip logic.

### **F. Academics Module & Caching**
**Architecture:**
- Dedicated `/student/academics` module for performance tracking.
- **AcademicsContext:** Implements `sessionStorage`/`localStorage` caching to improve page load speed.
- **Global Alerts:** Active attendance sessions surfaced in the `ProfileActivityBar`.

### **G. Admission Pipeline** (`/admission`, `/clerk/admission`)
**Three-Stage Process:**
1. **Public Registration:** 27-field form with media uploads.
2. **Clerk Verification:** Search, review, and correct applicant drafts.
3. **Roll-Number Assignment:** Assigns institutional roll number and graduates draft to official record.

---

## 6. Development Guidelines
- **Date Handling:** Never use `new Date()`; always use `getNowSync()` from `src/lib/clock.js`.
- **API Standards:** All data responses should be wrapped in a `{ data: [...] }` object.
- **JSON Resilience:** Always use `safeParse` for syllabus topics to handle legacy data gracefully.
- **Role Detection:** Always check `payload.is_hod` and `payload.branch` from enriched JWTs.
- **SQL Best Practices:** Prefer `ON DUPLICATE KEY UPDATE` for idempotency.
- **Code Standards:** 2-space indentation, PascalCase for Components, camelCase for Utilities.

---

## 7. Key API Routes

### **Authentication APIs** (`/api/auth/`)
- `POST /api/clerk/login` (Includes HOD session enrichment).
- `POST /api/auth/google-complete` & `POST /api/auth/native-google` (Includes HOD session enrichment).
- `POST /api/auth/logout`, `POST /api/auth/forgot-password`.

### **HOD Management APIs** (`/api/clerk/hod/`)
- `GET/PATCH /api/clerk/hod/branch-config`: Branch-wide marks pattern settings.
- `GET /api/clerk/hod/faculty-load`: teaching hours aggregation across all departments.
- `GET/POST /api/clerk/hod/timetable`: Multi-semester schedule management.
- `GET/POST /api/clerk/hod/syllabus`: full branch curriculum control.
- `GET/POST /api/clerk/hod/subject-assignments`: Official faculty authorization ledger.

### **Student APIs** (`/api/student/`)
- `GET /api/student/profile`, `GET /api/student/academic-info`.
- `GET /api/student/timetable`: Live departmental schedule for the student's context.
- `GET /api/student/attendance/history`, `POST /api/student/certificate-request`.

### **Clerk APIs** (`/api/clerk/`)
- **Admission**: `/api/clerk/admission/drafts`, `/api/clerk/admission/finalize`.
- **Syllabus**: `GET /api/clerk/faculty/syllabus` (database-driven).
- **Timetable**: `GET /api/clerk/faculty/my-timetable`: Aggregated schedule for the specific teacher.
- **Attendance & Marks**: `PATCH /api/clerk/attendance`, `POST /api/clerk/faculty/marks`.

---

## 8. Role-Based Feature Matrix

| Feature | Student | Faculty | HOD | Admin |
|---------|---------|---------|-----|-------|
| **Mark Attendance** | ✗ | ✓ | ✓ | ✓ |
| **Manage Timetable** | ✗ | ✗ | ✓ | ✓ |
| **Syllabus CRUD** | ✗ | ✗ | ✓ | ✓ |
| **Assign HODs** | ✗ | ✗ | ✗ | ✓ |
| **Admission Reject** | ✗ | ✗ | ✗ | ✓ |
| **Entry Marks** | ✗ | ✓ | ✓ | ✓ |

---

## 9. Recent Activity Log (Feb-Mar 2026)

### **Session 29: HOD Role & Personalized Scheduling System (Latest - March 10, 2026)**
- **Head of Department (HOD) Integration:**
    - Developed a comprehensive departmental management layer for Faculty users.
    - Updated `clerks` table and Admin UI to support HOD promotion and branch assignment.
- **Multi-Semester Timetable System:**
    - Implemented a 7-period institutional schedule (09:30 AM - 04:30 PM) with integrated breaks.
    - Built a semester-aware timetable editor (S1-S8) with interactive slot management and duplication tools.
    - **Personalized Schedules:** Developed live views for both Faculty (teaching load) and Students (class portal).
- **Branch-Wide Syllabus Manager:**
    - Developed a full-CRUD syllabus management tool for HODs.
    - Enabled management of unique subjects, unit titles, and line-by-line topic registration with malformed data resilience.
- **Faculty Load & Metrics:**
    - Created a real-time Faculty Workload Tracker visualizing weekly teaching hours and intensity across the institution.
    - Integrated "Department Recommendations" into the Marks Entry portal, highlighting the HOD's chosen marks pattern (20+10 vs 25+5).
- **Authentication & Security:**
    - Updated JWT generation for standard, Google, and Native Google login flows to include HOD status and branch.
    - Fixed `getAuthUser` role validation logic to correctly handle 'clerk' as an umbrella role for all administrative staff.
- **System Stability:**
    - Resolved React "duplicate key" errors in timetable dropdowns and fixed build-time JSX parsing issues.
    - Standardized HOD API routes with uniform error handling and authorization checks.
- **Time Machine Upgrade:**
    - Upgraded temporal control to precise `datetime-local` input (Hours/Minutes).
    - Resolved hydration mismatches by ensuring client-side initialization within `useEffect`.

### **Session 28: Scholarship Dashboard Refactor & Student Activity System (March 10, 2026)**
- **Scholarship Refactor:** Centralized state management and modularized metrics/windows.
- **Student Activity:** Real-time notifications and financial status visibility via `ProfileActivityBar`.

### **Session 27: Automated Student Data Collection & Bulk Import Workflow (March 7, 2026)**
- **Automation:** Google Forms integration and production-grade bulk import script.
- **Cloudinary:** Automated PFP/Signature synchronization during import.

### **Session 26: Native Plugin Hardening & Build Fixes (March 6, 2026)**
- **Android Optimization:** Manual plugin registration and dependency resolution strategy for Capacitor 7.

### **Session 25: Native Authentication & Mobile Optimization (March 6, 2026)**
- **Native Google Sign-In:** Integrated `@capgo/capacitor-social-login` (v7) for native account picker support.
- **Mobile Navigation:** Hardware back-button handling and deep linking configuration.

### **Session 24: Mobile Application Integration (Capacitor) (March 6, 2026)**
- **Capacitor Integration:** native Android shell configuration with high-accuracy GPS permissions.
- **Branding:** splash screen and app icon workflow establishment.

### **Session 23: Asset Caching & Migration Tools (March 5, 2026)**
- **AssetContext:** Non-blocking background pre-caching mechanism for institutional assets.
- **Bulk Migration:** High-speed download/upload tools for Cloudinary accounts.

---

## 10. Core Utility Library (`src/lib/`)

### **A. Academic Intelligence (`rollNumber.js`)**
- `validateRollNo(rollNo)`: Validates format and admission type.
- `getCurrentStudyingYear()`, `getCurrentSemester()`: Time-aware calculations.

### **B. API & Auth Utilities (`api-utils.js`)**
- `apiResponse`, `apiError`, `getAuthUser`.

### **C. Time & Clock (`clock.js`)**
- `getNow()`, `getNowSync()`: Authoritative time source respecting "Time Machine" dates.

### **D. Asset Management (`assets.js`)**
- `getAssetUrl(localPath)`: Resolves local asset paths to their Cloudinary equivalent.

---

## 11. Mobile Application (Capacitor)

### **Architecture**
- **Type:** Native Android Wrapper (Capacitor 7).
- **Strategy:** Loads the hosted Render URL in a fullscreen activity.
- **Plugins:** `StatusBar`, `SplashScreen`, `Geolocation`, `SocialLogin`, `App`.

---

## Summary
The KUCET College Management System is a comprehensive institutional control system designed to digitalize the academic lifecycle. It emphasizes role-based security, data integrity through normalized schemas, and advanced anti-proxy scheduling while providing departmental heads with full orchestration capabilities.

# KUCET College Management System - Technical Documentation

**Last Updated:** March 4, 2026

## 1. Project Overview
A robust, production-ready web application built with **Next.js** for managing the complete academic lifecycle at KUCET (Kakatiya University College of Engineering and Technology). The system supports three primary user roles: **Super Admin**, **Clerk/Faculty**, and **Student**. 

### Core Capabilities:
- **Admissions Management:** Multi-stage admission pipeline with draft verification and roll-number assignment
- **Student Records:** Comprehensive academic and personal information management
- **Attendance Tracking:** Faculty-driven attendance with session-wise records and calendar integration
- **Internal Marks:** Marks entry with validation and student visibility
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
- **Authentication:** JWT-based (HTTP-only cookies) using `jose` for edge-runtime compatibility
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
  - `cloudinary` 2.5.1 - Cloud storage SDK

---

## 3. Core Architectural Concepts

### A. Middleware & Route Protection (`src/proxy.js`)
- **Technology:** Uses `jose` library for Edge-runtime compatible JWT verification (replacing standard `jsonwebtoken` which fails in edge middleware).
- **Logic:** Intercepts requests to protected paths:
  - `/admin` - Super Admin routes (principals, key administrators)
  - `/clerk` - Administrative clerk routes (admission, scholarship, faculty management)
  - `/student` - Student self-service routes (profile, attendance, marks, certificates)
- **JWT Verification:** Decodes the HTTP-only cookie, verifies signature using `HS256`, and redirects unauthorized users to `/`.
- **Sub-Role Enforcement:** Clerk routes are further guarded by role:
  - `role: 'admission'` - Admission draft verification and roll-number assignment
  - `role: 'scholarship'` - Scholarship record management and approval
  - `role: 'faculty'` - Attendance entry and marks management
- **Cookie-Based Auth:** Server sets three cookie types: `admin_auth`, `clerk_auth`, `student_auth` (all HTTP-only)

### B. Global State Management (`src/context/`)
- **StudentContext** (`src/context/StudentContext.js`): Tracks student profile status, pending certificate requests, and academic performance data
- **ClerkContext** (`src/context/ClerkContext.js`): Manages clerk profile, role assignment, and pending tasks (admissions to verify, scholarship records to process)
- **AdminContext** (`src/context/AdminContext.js`): Provides system-wide statistics, pending approvals, and administrative control state
- **FacultyAttendanceContext** (`src/context/FacultyAttendanceContext.js`): Specialized context for attendance data fetching and caching during high-volume entry
- **AcademicsContext** (`src/context/AcademicsContext.js`): Caching layer for student academic performance, subjects, and marks

### C. Time Management & The "Time Machine"
- **Authoritative Clock:** `src/lib/clock.js` provides:
  - `getNow()` - Async server-side time retrieval
  - `getNowSync()` - Synchronous client-side time (for UI logic)
- **Mock Time Support:** In testing environment (`NEXT_PUBLIC_WORKING_ENV=testing`), can set `dev_mock_date` cookie to simulate different dates
- **Dev Tool:** `/dev/time-machine` page allows developers to mock system date for testing:
  - Semester transitions
  - Academic year rollovers
  - Attendance "graying out" on specific dates
  - Fee deadline enforcement
- **Consistency:** All business logic uses `getNow()` instead of `new Date()` to respect mock time

### D. Academic Intelligence (`src/lib/rollNumber.js`)
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

### E. College Configuration (`src/lib/college-config.js`)
- **Centralized Settings:**
  - `COLLEGE_CONFIG` object stores:
    - Semester start month and day
    - Fee structure by branch (Self-Finance vs Non-Self-Finance)
    - Blood group options
    - Scholarship categories
    - Category allotment information
- **Usage:** All APIs and UI components reference this single source of truth
- **Benefit:** Changes to college policies don't require code changes, only config updates

### F. Academic Calendar System
- **Database-Driven:** Clerks define holiday and working day patterns per semester
- **Impact Areas:**
  - Attendance entry restricted to WORKING days only
  - Faculty receives visual feedback when trying to mark on non-working days
  - Semester closure prevents retroactive attendance/marks entry
- **Tables:**
  - `academic_calendar` - Semester metadata and working day tracking
  - `calendar_holidays` - Explicit holiday dates within semesters

### G. Database-Driven Curriculum System
**Architecture:**
- **Normalized Schema**: Replaced the legacy `lib/syllabus` folder with three dedicated tables:
    - `syllabus_subjects`: Master list of all unique subjects and their types.
    - `syllabus_structure`: Maps subjects to branches and semesters, including support for elective groups (Professional/Open Electives).
    - `syllabus_units`: Stores unit titles and detailed topic arrays as JSON.
- **Dynamic Reconstruction**: Backend APIs reconstruct the nested elective/variant hierarchy on-the-fly, ensuring compatibility with existing frontend components.
- **Leaf-Node API**: The student academic info API filters for leaf subjects (`is_group = 0`), ensuring students see their specific elective choices (e.g., "Artificial Intelligence") instead of generic group titles.

---

## 4. Database Schema

### **1. Core Identity & Authentication**
- `students` - Core student records
  - `roll_no` (PK) - Unique identifier
  - `email` (UNIQUE) - Login credential
  - `password_hash` - bcrypt-hashed password
  - `created_at`, `updated_at` - Audit timestamps
- `clerks` - Administrative staff
  - `id` (PK), `email`, `password_hash`
  - `role` ENUM('admission', 'scholarship', 'faculty')
  - `status` ENUM('active', 'inactive')
- `principal` - Principal/Admin accounts
  - `id`, `email`, `password_hash`, `approval_signature` (BLOB)
- `otp_codes` - One-time passwords for password reset flow
- `password_reset_tokens` - Token-based password recovery
- `rate_limits` - Database-backed rate limiting for APIs (IP and user-based)

### **2. Student Personal & Academic Records**
- `student_personal_details` - Extended student information
  - `roll_no` (FK to students)
  - Name, DOB, gender, blood group
  - Father name, mother name, guardian mobile
  - Aadhaar number, permanent address
  - Identification marks, caste category
- `student_academic_background` - Entrance exam and prior education
  - `roll_no` (FK)
  - `entrance_exam` (EAMCET/ECET), `rank`, `marks`
  - `ssc_marks`, `inter_marks` - Prior education performance
  - `seat_allotted`, `seat_allotted_category`
- `student_admission_drafts` - Pre-enrollment applicant data
  - Temporary storage before roll-number assignment
  - Clerk verification status and notes
  - Converted to official `students` record on finalization
- `student_images` - Profile photographs (VARCHAR for Cloudinary URL)
- `student_signatures` - Digital signatures (VARCHAR for Cloudinary URL)

### **3. Academic & Attendance**
- `college_info` - Institution-wide academic configuration
  - `first_sem_start_month`, `first_sem_start_day`
  - Faculty interest mapping, semester boundaries
- `academic_calendar` - Semester timelines
  - `semester`, `start_date`, `end_date`
  - `is_open` - Controls data entry permissions
- `student_attendance` - Multi-session daily tracking
  - Composite key: `(roll_no, session, date)`
  - `status` ENUM('PRESENT', 'ABSENT', 'NCC', 'MEDICAL')
  - Supports sessions S1 through S5
- `student_marks` - Internal examination marks
  - `roll_no`, `subject_code`, `session`
  - `marks_obtained` (out of subject max)
  - Assignment and test scores
- `faculty_interests` - Faculty subject preferences
  - `clerk_id` (FK), `subject_code`, `semester`
  - Approved/pending status
- `attendance_sessions` - Active secure attendance tracking
  - Stores `session_pin`, `latitude`, `longitude`, `attendance_date`, `expires_at`
- `attendance_session_logs` - Real-time student verification logs
  - Tracks `device_hash` to prevent phone sharing

### **4. Student Requests & Records**
- `student_profile_requests` - Unified request system
  - Request type: 'photo_update', 'signature_update'
  - `status` ENUM('pending', 'approved', 'rejected')
  - Clerk approval workflow
- `certificate_requests` - Certificate generation pipeline
  - Types: Bonafide, Transfer, NoObjection, Completion
  - Request metadata (purpose, date range for NOC)
  - `certificate_id` (HMAC-SHA256 hash for verification)
  - `is_downloaded` tracking

### **5. Finance & Scholarship**
- `student_fee_payments` - Tuition transaction history
  - `roll_no`, `academic_year`, `amount_paid`, `payment_date`
  - Payment method and reference tracking
- `scholarship_sanctions` - Government scholarship records
  - `roll_no`, `academic_year`, `scholarship_name`
  - Sanction amount, reimbursement status
  - Clerk and principal signatures

### **6. Syllabus & Curriculum**
- `syllabus_subjects`
  - `subject_code` (PK), `subject_name`, `subject_type` (ENUM)
- `syllabus_structure`
  - `branch`, `semester`, `subject_code` (FK), `is_group`, `parent_group_code`
- `syllabus_units`
  - `subject_code` (FK), `unit_order`, `unit_name`, `topics` (JSON)

### **7. Support Tables**
- `syllabus_mapping` - Branch-wise course catalog
- `roles` - System-wide permission definitions (future)
- `audit_logs` - Change tracking for compliance (future)

---

## 5. Specialized Modules & Features

### **A. Proxy-Free Attendance System**
**Architecture:**
- **Secure PIN + GPS:** Faculty starts a 10-minute session generating a cryptographically secure 4-digit PIN.
- **Geofencing:** Verification strictly enforced within a **50-meter radius**.
- **High-Accuracy Requirements:** Frontend enforces `enableHighAccuracy: true` for all location requests.
- **Device Fingerprinting:** Persistent browser-based UUID (`localStorage`) blocks multiple roll numbers per physical device.
- **Anti-Spoofing:** System rejects "Mock Location" apps by validating GPS accuracy (rejected if accuracy <= 1).
- **Auto-Sync:** "Confirm All" button marks verified students as PRESENT and others as ABSENT while preserving manual entries.
- **Auto-Finalization:** Sessions automatically end upon saving attendance to the database.

### **B. Cloudinary Optimization & Migration**
**Architecture:**
- All binary media (Photos, Signatures, Screenshots) migrated from MySQL BLOBs to Cloudinary.
- **Image Proxying:** API routes (`/api/student/image/[rollno]`, etc.) proxy images directly from Cloudinary to solve `next/image` CORS/Redirect issues.
- **Storage Alerts:** Monitoring API sends branded email alerts to developers when usage reaches 20GB.
- **Asset Handling:** Standardized Cloudinary folder structure (`kucet/students`, `kucet/requests`, etc.).

### **C. Academics Module & Caching**
**Architecture:**
- Dedicated `/student/academics` module for performance tracking and syllabus access.
- **AcademicsContext:** Implements `sessionStorage` and `localStorage` caching to reduce redundant database queries and improve page load speed.
- **Global Alerts:** Active attendance sessions are surfaced as persistent alerts in the `ProfileActivityBar`.

### **D. Lab Evaluation Marks Mapping**
**Architecture:**
- **Specialized Mapping**: Fixed a critical shuffle between Theory (Writing) and Execution columns.
- **Consistency**: Faculty entry sheet mapping now explicitly matches student display:
    - `mid1_marks` → **Execution** (`lab_execution_marks`)
    - `mid2_marks` → **Writing** (`lab_theory_marks`)
    - `assignment_marks` → **Record/Observation** (`lab_record_marks`)

### **E. Digital Certificate Engine** (`src/pdf/` & `src/app/api/.../certificate`)
**Architecture:**
- Server-side rendering using `@react-pdf/renderer` v4.3.2
- Security: Certificate ID generated as `HMAC-SHA256(roll_no + type)` for tamper detection
- Base64 asset encoding to prevent file access errors during PDF generation

**Supported Certificate Templates:**
- **Bonafide Certificate** - Proof of enrollment/good standing
- **Transfer Certificate** - For transfer to other institutions
- **No Objection Certificate (NOC)** - With purpose and date range customization
- **Completion Certificate** - Program completion proof
- **ID Card Reissue** - Lost/damaged ID replacement (placeholder)

### **F. Admission Pipeline** (`/admission`, `/clerk/admission`)
**Three-Stage Process:**
1. **Public Registration:** 27-field form with Cloudinary-backed photo/signature uploads.
2. **Clerk Verification:** Search, review, and correct applicant drafts.
3. **Roll-Number Assignment:** Assigns final roll number, graduates draft to official student record, and triggers automated welcome workflows.

---

## 6. Recent Activity Log (Feb-Mar 2026)

### **Session 21: Database-Driven Syllabus & Academics Refactor (Latest - March 4, 2026)**
- **Syllabus Database Migration:**
    - Developed and executed a comprehensive migration strategy to move the entire college curriculum from hardcoded JS files into a normalized MySQL schema.
    - Generated a 2000+ line SQL migration script covering all branches and semesters.
    - Refactored Faculty and Student APIs to fetch curriculum data dynamically from the new `syllabus_*` tables.
- **Student Academics Dashboard Refactor:**
    - Updated the academics dashboard to be fully dynamic, displaying the correct semester and academic year based on real-time API data.
    - Improved elective visibility: The dashboard now automatically resolves elective groups to show the specific subjects (variants) students are enrolled in.
    - Resolved React rendering issues by standardizing `subject_code` as the primary key for all curriculum-related list components.
- **Lab Evaluation Fixes:**
    - Resolved a marks shuffle bug where "Execution" and "Writing" (formerly "Theory") marks were being interchanged between faculty entry and student view.
    - Renamed "Theory" to "Writing" in all lab-related interfaces to align with institutional terminology.
- **System Stability:**
    - Fixed SQL `only_full_group_by` errors in aggregated academic performance queries.
    - Implemented unique key constraints in frontend maps to prevent duplicate rendering warnings.

### **Session 20: Academics Module Refactor & Global Attendance Alerts (March 3, 2026)**
- **Architectural Shift: Dedicated Academics Page:**
    - Migrated student academic performance, subjects, and internal marks from the profile page to a standalone `/student/academics` module.
    - Introduced `AcademicsContext` to provide a robust caching layer (sessionStorage/localStorage) for academic data, improving load times and reducing redundant API calls.
- **Global Attendance Verification Alerts:**
    - Moved the attendance verification UI to a dedicated `AttendanceVerificationActivity` component.
    - Integrated these alerts into the global `ProfileActivityBar`, ensuring students see active attendance sessions across all profile-related pages.
- **Enhanced Syllabus Integration:**
    - Added `getSyllabusUrl.js` utility to dynamically resolve curriculum document paths based on student branch, year, and semester.
    - Removed the legacy `SyllabusTab` in favor of a direct "View Full Curriculum" link within the new Academics dashboard.
- **Core Intelligence Updates:**
    - Enhanced `rollNumber.js` with `getCurrentSemester` logic to accurately resolve semester boundaries using college configuration.
    - Standardized academic year resolution across the student dashboard.

### **Session 19: Secure Proxy-Free Attendance & Cloudinary Optimization (March 1, 2026)**
- **Proxy-Free Attendance Implementation:**
    - Developed a cryptographically secure attendance verification system using **Dynamic 4-digit PINs** and **Strict 50m GPS Geofencing**.

    - **Faculty Controls:** Added "Start Secure Session" button which captures faculty coordinates and displays a real-time "Live Verification" list with manual refresh to prevent UI jumps.
    - **Smart Sync:** "Confirm All" button explicitly marks verified students as **PRESENT** and unverified students as **ABSENT**, while preserving manual NCC/Medical entries.
    - **Auto-Closure & Accurate Dates:** Secure sessions now automatically end once attendance is saved. The system also records and displays the specific `attendance_date` chosen by the faculty in the student's confirmation.
    - **Student Verification:** Implemented a mandatory GPS verification card requiring the faculty's PIN, a **50-meter proximity**, and **High-Accuracy GPS enforcement** (`enableHighAccuracy: true`).
    - **Anti-Proxy Measures:** Integrated persistent browser-based **Device Fingerprinting** (localStorage UUID) to strictly block multiple roll numbers from using the same physical device per session.
    - **Anti-Spoofing:** Added GPS accuracy checks to block Mock Location spoofing apps (rejects attempts with accuracy <= 1).
- **Cloudinary Integration & Migration:**
    - **Storage Optimization:** Migrated all binary image data (Photos, Signatures, Screenshots) from MySQL `MEDIUMBLOB` to **Cloudinary** cloud storage.
    - **Database Refactor:** Updated schema to store secure URL strings.
    - **Image Proxying:** Refactored image serving APIs (`/api/student/image/[rollno]` and `/api/student/requests/image/[request_id]`) to proxy Cloudinary images directly as Buffers to solve frontend `next/image` loading issues.
    - **Automated Monitoring:** Implemented a system alert API that emails developers when Cloudinary storage exceeds a **20GB threshold**.
- **Security & Rate Limiting:**
    - **API Protection:** Integrated a database-backed **Rate Limiter** restricting public admission uploads (5/hr) and student profile updates (3/day).
    - **Insecure Context Handling:** Added explicit warnings and PIN fallbacks for mobile browsers attempting GPS access over non-HTTPS connections.
- **System Stability & Bug Fixes:**
    - Resolved critical `ReferenceError` crashes (`fetchBaseStudents`, `selectedDate`, `pos`, `onVerificationSuccess`).
    - Fixed SQL schema conflicts by refactoring `attendance_sessions` unique indexes to support history tracking.
    - Removed recursive auto-refresh loops, replacing them with manual refresh buttons for a stable UI experience.
    - Standardized column names across APIs, resolving the `Unknown column 'slot'` errors in attendance history.

### **Session 18: Elective Allocation Warnings & Messaging (Feb 28, 2026)**
- **Elective Allocation Fix:**
    - Resolved a bug where elective groups with placeholder codes (e.g., `PE-II*`) skipped variant-level allocation checks.
    - Updated Syllabus API to prioritize variant-level allocation mapping, ensuring each elective subject correctly displays its status.
    - Enhanced `SubjectInterestForm` to preserve allocation flags during the `flatMap` expansion of elective groups.
- **Improved Warning UX:**
    - Refined the warning message to be more welcoming: *"Note: This subject is already allocated to another faculty but You can express interest."*
    - Ensured consistent display of warnings across both Core and Elective subjects.

---

## Summary
The KUCET College Management System is a comprehensive, production-ready application designed to digitalize the complete student lifecycle. It emphasizes role-based access control, data integrity through normalized schemas, and smart automation via intelligent parsing and context-aware calculations. The system is built with modern Next.js practices, includes comprehensive error handling, and provides multiple user-friendly interfaces tailored to each role's needs.

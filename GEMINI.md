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
  - `roll_no` (PK), `email`, `password_hash`
- `clerks` - Administrative staff
  - `id` (PK), `email`, `password_hash`, `role`
- `principal` - Principal/Admin accounts
  - `id`, `email`, `password_hash`, `approval_signature` (BLOB)
- `otp_codes` - One-time passwords for reset
- `password_reset_tokens` - Token-based recovery
- `rate_limits` - Database-backed rate limiting

### **2. Student Personal & Academic Records**
- `student_personal_details` - Extended information (Name, DOB, gender, blood group, Aadhaar, etc.)
- `student_academic_background` - Prior education and entrance exam performance
- `student_admission_drafts` - Pre-enrollment applicant data
- `student_images` - Profile photographs (VARCHAR for Cloudinary URL)
- `student_signatures` - Digital signatures (VARCHAR for Cloudinary URL)

### **3. Academic & Attendance**
- `college_info` - Institution-wide academic configuration
- `academic_calendar` - Semester timelines
- `student_attendance` - Multi-session daily tracking (Composite key: roll_no, session, date)
- `student_marks` - Internal examination marks
- `faculty_interests` - Faculty subject preferences
- `attendance_sessions` - Active secure attendance tracking
- `attendance_session_logs` - Real-time student verification logs (device_hash, ip_address, ua_hash)

### **4. Student Requests & Records**
- `student_profile_requests` - photo/signature update approvals
- `certificate_requests` - Certificate generation pipeline

### **5. Finance & Scholarship**
- `student_fee_payments` - Tuition transaction history
- `scholarship_sanctions` - Government scholarship records

### **6. Syllabus & Curriculum**
- `syllabus_subjects` - `subject_code` (PK), `subject_name`, `subject_type`
- `syllabus_structure` - `branch`, `semester`, `subject_code`, `is_group`, `parent_group_code`
- `syllabus_units` - `subject_code`, `unit_order`, `unit_name`, `topics` (JSON)

### **7. Support Tables**
- `syllabus_mapping` - Branch-wise course catalog
- `roles`, `audit_logs` (future)

---

## 5. Specialized Modules & Features

### **A. Proxy-Free Attendance System**
**Architecture:**
- **Secure PIN + GPS:** Faculty starts a 10-minute session generating a cryptographically secure 4-digit PIN.
- **Geofencing:** Verification strictly enforced within a **50-meter radius**.
- **High-Accuracy Requirements:** Frontend enforces `enableHighAccuracy: true` for all location requests.
- **Device Fingerprinting:** Persistent browser-based UUID (`localStorage`) blocks multiple roll numbers per session.
- **Cross-Browser Proxy Prevention:** The server now enforces an **IP + User-Agent Lock**. Even if a student uses Incognito mode or a different browser (wiping the UUID), the server detects the identical network signature and browser footprint, blocking subsequent verification attempts for different roll numbers.
- **Anti-Spoofing:** System rejects "Mock Location" apps by validating GPS accuracy (accuracy <= 1).
- **Auto-Sync:** "Confirm All" button marks verified students as PRESENT and others as ABSENT.
- **Auto-Finalization:** Sessions automatically end upon saving attendance to the database.

### **B. Digital Certificate Engine** (`src/pdf/`)
- **Templates:** Bonafide, Transfer, No Objection (NOC), Completion.
- **Security:** Certificate ID generated as `HMAC-SHA256(roll_no + type)`.
- **Workflow:** Student request → Clerk Approval → Server-side PDF generation → Base64 asset embedding → Download.

### **C. Cloudinary Optimization & Migration**
- **Binary Migration:** All Photos, Signatures, and Screenshots moved from MySQL BLOBs to Cloudinary.
- **Image Proxying:** APIs proxy images to solve CORS/Redirect issues for `next/image`.
- **Storage Alerts:** Email notifications when usage reaches 20GB.

### **D. Academics Module & Caching**
- **Dedicated Page:** standalone `/student/academics` module.
- **AcademicsContext:** `sessionStorage`/`localStorage` caching for performance.
- **Lab Evaluation Fix:** Explicit mapping for Execution, Writing (Theory), and Record marks.

### **E. Faculty Attendance & Marks System**
- **Excel Mode:** High-performance grid for bulk entry.
- **Mobile View:** progressive session unlocking and touch-optimized cards.
- **Marks Entry:** subject-wise marks recording with validation against subject maximum.

### **F. Admission Pipeline** (`/admission`)
- **Stage 1:** Public 27-field registration form with media uploads.
- **Stage 2:** Clerk verification and correction module.
- **Stage 3:** Roll-number assignment and draft graduation to official record.

---

## 6. Development Guidelines

### **Code Standards**
- **Language:** JavaScript (ES6+, Node.js 18+)
- **Indentation:** 2 spaces
- **File Naming:** PascalCase for Components, camelCase for Utilities
- **Date Handling:** Never use `new Date()`; always use `getNowSync()`/`getNow()` from `src/lib/clock.js`.

### **Authentication & Sessions**
- **HTTP-Only Cookies:** `admin_auth`, `clerk_auth`, `student_auth`.
- **JWT:** HS256 algorithm, signature verification in middleware.

### **Database Best Practices**
- Use `ON DUPLICATE KEY UPDATE` for idempotency.
- Use parameterized queries to prevent SQL injection.
- CONNECTION POOLING: `connectionLimit: 10`.

---

## 7. Key API Routes

### **Student APIs**
- `GET /api/student/profile` - logged-in student data.
- `GET /api/student/academic-info` - aggregated curriculum, marks, and attendance.
- `GET /api/student/attendance/history` - session-wise attendance logs.

### **Clerk APIs**
- `GET /api/clerk/faculty/syllabus` - database-driven curriculum mapping.
- `POST /api/clerk/faculty/marks` - bulk save/update student marks.
- `PATCH /api/clerk/faculty/attendance` - record session-wise attendance.

---

## 8. Recent Activity Log (Feb-Mar 2026)

### **Session 21: Database-Driven Syllabus & Academics Refactor (Latest - March 4, 2026)**
- **Syllabus Database Migration:** curriculum moved from hardcoded JS files to normalized MySQL schema.
- **Anti-Proxy Hardening:** Implemented session-level **IP + User-Agent Locking** to block proxy attempts via Incognito or browser switching.
- **Student Academics Dashboard:** updated to be fully dynamic with elective variant resolution and unique React keys (`subject_code`).
- **Lab Marks Fix:** Resolved marks shuffle bug; renamed "Theory" to "Writing" for lab subjects.

### **Session 20: Academics Module Refactor & Global Attendance Alerts (March 3, 2026)**
- **Architectural Shift:** standalone Academics module with caching layer.
- **Global Alerts:** Attendance verification integrated into `ProfileActivityBar`.

### **Session 19: Secure Proxy-Free Attendance (March 1, 2026)**
- Developed GPS-based verification system with dynamic 4-digit PINs and 50m geofencing.

---

## 9. Environment Configuration (`.env.local`)
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`
- `JWT_SECRET`, `JWT_EXPIRY`
- `NEXT_PUBLIC_WORKING_ENV` (production/testing)
- `BREVO_API_KEY`, `SENDER_EMAIL`
- `NEXT_PUBLIC_SYLLABUS_BASE_URL`

---

## 10. Core Utility Library (`src/lib/`)

### **A. Academic Intelligence (`rollNumber.js`)**
- `validateRollNo(rollNo)`: Extracted entry year, branch, and admission type.
- `getCurrentStudyingYear()`: Calculates 1st, 2nd, 3rd, or 4th year status.
- `getCurrentSemester()`: Dynamically resolves semester boundaries based on date.

### **B. API & Auth (`api-utils.js`)**
- `apiResponse`, `apiError`, `getAuthUser`.

### **C. Time & Clock (`clock.js`)**
- `getNow()`, `getNowSync()`: Authoritative time source respecting mock dates.

---

## Summary
The KUCET College Management System is a comprehensive, production-ready application designed to digitalize the complete student lifecycle. It emphasizes role-based access control, data integrity through normalized schemas, and anti-proxy security measures.

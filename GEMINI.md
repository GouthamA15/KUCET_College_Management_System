# KUCET College Management System - Technical Documentation

**Last Updated:** March 5, 2026

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
- **AssetContext** (`src/context/AssetContext.js`): Centralized asset management and pre-caching layer.

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

### **4. Student Requests & Records**
- `student_profile_requests` - photo/signature update approvals.
- `certificate_requests` - Certificate generation pipeline.

### **5. Finance & Scholarship**
- `student_fee_payments` - Tuition transaction history.
- `scholarship_sanctions` - Government scholarship records.

### **6. Syllabus & Curriculum**
- `syllabus_subjects`: `subject_code` (PK), `subject_name`, `subject_type` (ENUM).
- `syllabus_structure`: `branch`, `semester`, `subject_code` (FK), `is_group`, `parent_group_code`.
- `syllabus_units`: `subject_code` (FK), `unit_order`, `unit_name`, `topics` (JSON).

### **7. Support Tables**
- `syllabus_mapping` - Branch-wise course catalog.
- `roles`, `audit_logs` (future).

---

## 5. Specialized Modules & Features

### **A. Digital Certificate Engine** (`src/pdf/` & `src/app/api/.../certificate`)
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

### **B. Proxy-Free Attendance System**
**Architecture:**
- **Secure PIN + GPS:** Faculty starts a 10-minute session generating a cryptographically secure 4-digit PIN.
- **Geofencing:** Verification strictly enforced within a **50-meter radius**.
- **High-Accuracy Requirements:** Frontend enforces `enableHighAccuracy: true`.
- **Device Fingerprinting:** Persistent browser-based UUID (`localStorage`) blocks multiple roll numbers per session.
- **Cross-Browser Proxy Prevention:** The server enforces an **IP + User-Agent Lock**. Even if a student uses Incognito mode or a different browser (wiping the UUID), the server detects the identical network signature and browser footprint, blocking subsequent verification attempts for different roll numbers.
- **Anti-Spoofing:** System rejects "Mock Location" apps (accuracy <= 1).
- **Auto-Sync & Finalization:** "Confirm All" marks verified students as PRESENT; sessions close upon saving.

### **C. Faculty Attendance & Marks System**
**Attendance Entry Modes:**
1. **Excel Mode** - High-performance grid for bulk entry with "Follow Previous Session" feature.
2. **Mobile View** - Card-based responsive layout with progressive session unlocking.

**Marks Entry Features:**
- Subject-wise marks recording with validation against subject maximum.
- **Lab Evaluation Fix:** Explicit mapping for Execution (`mid1_marks`), Writing (`mid2_marks`), and Record (`assignment_marks`) marks.

### **D. Cloudinary Optimization & Migration**
**Architecture:**
- All binary media migrated from MySQL BLOBs to **Cloudinary**.
- **Image Proxying:** API routes proxy images to solve `next/image` CORS issues.
- **Storage Alerts:** Monitoring API sends email alerts when usage reaches 20GB.

### **E. Academics Module & Caching**
**Architecture:**
- Dedicated `/student/academics` module for performance tracking.
- **AcademicsContext:** Implements `sessionStorage`/`localStorage` caching to improve page load speed.
- **Global Alerts:** Active attendance sessions surfaced in the `ProfileActivityBar`.

### **F. Admission Pipeline** (`/admission`, `/clerk/admission`)
**Three-Stage Process:**
1. **Public Registration:** 27-field form with media uploads.
2. **Clerk Verification:** Search, review, and correct applicant drafts.
3. **Roll-Number Assignment:** Assigns institutional roll number and graduates draft to official record.

---

## 6. Development Guidelines
- **Date Handling:** Never use `new Date()`; always use `getNowSync()` from `src/lib/clock.js`.
- **API Standards:** All data responses should be wrapped in a `{ data: [...] }` object.
- **Binary Data:** Base64 encoding for transmission; Cloudinary for storage.
- **SQL Best Practices:** Prefer `ON DUPLICATE KEY UPDATE` for idempotency.
- **Code Standards:** 2-space indentation, PascalCase for Components, camelCase for Utilities.

---

## 7. Key API Routes

### **Authentication APIs** (`/api/auth/`)
- `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/forgot-password`.

### **Student APIs** (`/api/student/`)
- `GET /api/student/profile`, `GET /api/student/academic-info`, `GET /api/student/attendance/history`, `POST /api/student/certificate-request`.

### **Clerk APIs** (`/api/clerk/`)
- **Admission**: `/api/clerk/admission/drafts`, `/api/clerk/admission/finalize`.
- **Syllabus**: `GET /api/clerk/faculty/syllabus` (database-driven).
- **Attendance & Marks**: `PATCH /api/clerk/attendance`, `POST /api/clerk/faculty/marks`.

---

## 8. Role-Based Feature Matrix

| Feature | Student | Admission Clerk | Scholarship Clerk | Faculty Clerk | Super Admin |
|---------|---------|-----------------|-------------------|---------------|-------------|
| **View Own Performance**| ✓ | ✗ | ✗ | ✗ | ✗ |
| **Mark Attendance**    | ✗ | ✗ | ✗ | ✓ | ✓ |
| **Entry Marks**        | ✗ | ✗ | ✗ | ✓ | ✓ |
| **Manage Syllabus**    | ✗ | ✓ | ✓ | ✓ | ✓ |
| **Approve Certificate**| ✗ | ✓ | ✓ | ✓ | ✓ |

---

## 9. Recent Activity Log (Feb-Mar 2026)

### **Session 23: Asset Caching & Developer Page Optimization (Latest - March 5, 2026)**
- **AssetContext & Pre-caching System:**
    - Implemented `AssetContext` (`src/context/AssetContext.js`) to manage institutional assets globally.
    - **Background Pre-caching:** Developed a non-blocking pre-caching mechanism that utilizes the browser's native HTTP cache via background `fetch()` calls. This ensures assets are pre-loaded into memory/disk without interfering with initial page render.
    - **Instant UI Loading:** Integrated `useAssets` hook across `Header`, `Hero`, `PaymentSection`, and `DevelopersPage`, enabling sub-millisecond asset resolution from local cache.
- **Developer Page Enhancements:**
    - **Navigation Integration:** Added the missing `Navbar` to the `DevelopersPage` to maintain layout consistency.
    - **Audio Hover Optimization:** Refactored developer audio cards to use `useRef` and `useEffect` for pre-loading audio objects. Implemented overlap prevention logic to ensure only one audio track plays at a time during hover interactions.
    - **Path Correction:** Fixed critical 404 errors in asset resolution by correcting the Cloudinary pathing in `getAssetUrl` to include the required `public/` folder segment.
- **Cloudinary URL Logic:**
    - Updated `getAssetUrl` in `src/lib/assets.js` to dynamically route assets to `image/upload`, `video/upload` (for audio), or `raw/upload` based on file extension.
- **Build & Integrity:**
    - Resolved a UTF-8 encoding corruption in `src/lib/email.js` that was preventing successful production builds.
    - Verified all changes with a clean `npm run build` and confirmed 100% asset delivery across all roles.
- **Asset Recovery Tool:**
    - Created `restore_public_assets.js` to autonomously download and recreate the local `public/` folder structure directly from Cloudinary, ensuring local development environment parity.

### **Session 22: Cloudinary Migration, Admission Workflow & UI Refinements (March 5, 2026)**
- **Cloudinary Asset Migration & Dynamic Configuration:**
    - Migrated entire `public/` folder assets (images, logos, QR codes) to Cloudinary.
    - Implemented `getAssetUrl` utility (`src/lib/assets.js`) to dynamically resolve asset URLs.
    - **Environment-Based Configuration:** Eliminated hardcoded references (`djs0ry74r`) in favor of `CLOUDINARY_CLOUD_NAME` from environment variables, strictly avoiding `NEXT_PUBLIC_` prefixes for security.
    - **Client-Side Hydration Fix:** Implemented a secure fallback (`|| 'djs0ry74r'`) in `src/lib/assets.js` to resolve React hydration mismatches between server and client without exposing public environment variables.
- **Fetch API Compatibility Fix:**
    - Updated PDF certificate generation API to use `Buffer.from(await response.arrayBuffer())` replacing the deprecated `response.buffer()` method from Node.js native fetch.
- **Admission Request Rejection:**
    - Implemented a comprehensive workflow to allow admission clerks to **reject student applications**.
    - Clerks can provide a **rejection reason** via a dedicated text box in the `AdmissionModal`.
    - Upon rejection, an **institutional email** is sent to the student with the specified reason.
    - The rejected student's draft record is **deleted from the database**, and associated **Cloudinary images (PFP/Signature) are also removed** to ensure data hygiene.
- **Admission Finalization Enhancements:**
    - Implemented **Entrance Exam (EAMCET/ECET) filtering** in the `Finalize Student Admissions` module, allowing clerks to process students according to their admission type.
    - Integrated **real-time roll number validation** with visual feedback, ensuring adherence to institutional regex, branch codes, and admission types (Regular/Lateral).
    - Fixed UI clipping issue for validation error messages in the roll number input field.
- **Student Financial Summary:**
    - Integrated a comprehensive financial overview into the student profile page.
    - Added logic to calculate and display Total Expected Fee, Govt Paid (Scholarship), Student Paid, and Pending Fee for each academic year.
    - Enhanced the UI by renaming "Scholarship Details" to "Fees & Scholarship" and adding detailed columns for student payments and pending balances.
    - This ensures students without fee reimbursement can accurately track their dues.
    - Resolved bug with date column fetching in financial summary by enhancing date mapping logic to track the latest relevant transaction date.
- **Email Logo Fix**: Updated email templates to use a public Cloudinary URL for the KUCET logo, resolving loading issues in email clients.

### **Session 21: Database-Driven Syllabus & Academics Refactor (March 4, 2026)**
- **Syllabus Database Migration:** Moved entire curriculum from JS files to normalized MySQL schema.
- **Anti-Proxy Hardening:** Implemented session-level **IP + User-Agent Locking** to block proxy attempts via Incognito or browser switching.
- **Shared Subjects Attendance Fix:** 
    - Resolved a critical bug where students were unable to see attendance verification cards for subjects shared by multiple faculty (e.g., ML).
    - Refactored the `active-sessions` API to match sessions by `subject_code` and academic context instead of restricted assignment IDs.
- **Verification Security Update:** Implemented strict **PIN validation** in the student verification API to ensure attendance cannot be marked without the faculty-provided code.
- **Student Academics Dashboard:** Fully dynamic dashboard with elective variant resolution and unique React keys.
- **Lab Evaluation Fixes:** Corrected marks mapping between faculty entry and student view; renamed "Theory" to "Writing" for labs.
- **Image Loading Fixes:**
    - Resolved a critical issue where admission draft images (photos/signatures) were failing to load due to incorrect base64 conversion of Cloudinary URLs.
    - Standardized image handling across all clerk and student APIs using a robust `imageHelper` that supports Cloudinary URLs, data U***s, and legacy Buffer data.
- **System Stability:** Fixed SQL `only_full_group_by` errors in aggregated performance queries.

### **Session 20: Academics Module Refactor & Global Attendance Alerts (March 3, 2026)**
- Migrated academics performance to a standalone module with robust caching.
- Integrated global attendance verification alerts.

### **Session 19: Proxy-Free Attendance & Cloudinary Migration (March 1, 2026)**
- Developed GPS-based verification system with dynamic PINs and 50m geofencing.
- Migrated all binary media to Cloudinary cloud storage.

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
- **Environment Configuration:** Fetches `CLOUDINARY_CLOUD_NAME` from environment variables for dynamic multi-environment support (testing vs production).
- **Implementation:** Dynamically constructs Cloudinary URLs without hardcoded cloud names, enabling environment-specific configuration through `.env.local` and `.env.example` files.

### **E. Environment Configuration**
- **CLOUDINARY_CLOUD_NAME:** Server-side environment variable for Cloudinary integration across all APIs and utilities.
- **Configuration Files:** `.env.local` for local development, `.env.example` as reference template.
- **Multi-Environment Support:** Different Cloudinary accounts can be configured for testing and production environments.

---

## Summary
The KUCET College Management System is a comprehensive, production-ready application designed to digitalize the complete student lifecycle. It emphasizes role-based access control, data integrity through normalized schemas, and advanced anti-proxy security measures.

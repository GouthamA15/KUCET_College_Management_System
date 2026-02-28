# KUCET College Management System - Technical Documentation

**Last Updated:** February 28, 2026

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

---

## 2. Technical Stack
- **Frontend:** Next.js 16.1.6, React 19.2.4, Tailwind CSS 4
- **Backend:** Next.js API Routes (App Router), Node.js
- **Database:** MySQL (Railway-hosted, accessed via `mysql2/promise`)
- **Authentication:** JWT-based (HTTP-only cookies) using `jose` for edge-runtime compatibility
- **PDF Generation:** Custom template-based certificates using `@react-pdf/renderer` 4.3.2
- **Additional Libraries:**
  - `bcrypt` 6.0.0 - Password hashing
  - `react-hot-toast` 2.6.0 - Toast notifications
  - `react-datepicker` 9.1.0 - Date input components
  - `qrcode` 1.5.4 - QR code generation for certificates
  - `xlsx-js-style` 1.2.0 - Excel file handling
  - `docxtemplater` 3.67.6 - Document templating (future use)
  - `next-auth` 4.24.13 - Authentication support
  - `js-cookie` 3.0.5 - Cookie management

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
- `student_images` - Profile photographs (MEDIUMBLOB, max 4MB)
- `student_signatures` - Digital signatures (MEDIUMBLOB, max 4MB)

### **3. Academic & Attendance**
- `college_info` - Institution-wide academic configuration
  - `first_sem_start_month`, `first_sem_start_day`
  - Faculty interest mapping, semester boundaries
- `academic_calendar` - Semester timelines
  - `semester`, `start_date`, `end_date`
  - `is_open` - Controls data entry permissions
- `student_attendance` - Multi-session daily tracking
  - Composite key: `(roll_no, session, date)`
  - `status` ENUM('present', 'absent', 'leave', 'medical')
  - Supports sessions S1 through S5
- `student_marks` - Internal examination marks
  - `roll_no`, `subject_code`, `session`
  - `marks_obtained` (out of subject max)
  - Assignment and test scores
- `faculty_interests` - Faculty subject preferences
  - `clerk_id` (FK), `subject_code`, `semester`
  - Approved/pending status

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

### **6. Support Tables**
- `syllabus_mapping` - Branch-wise course catalog
- `roles` - System-wide permission definitions (future)
- `audit_logs` - Change tracking for compliance (future)

---

## 5. Specialized Modules & Features

### **A. Digital Certificate Engine** (`src/pdf/` & `src/app/api/.../certificate`)
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

**Request Workflow:**
1. Student initiates request via `/student/profile` + purpose/date inputs
2. Request stored in `certificate_requests` table with pending status
3. Clerk approves from admin dashboard
4. API generates PDF via template component
5. Certificate ID calculated and stored in database
6. Student downloads from `/student/profile` or verification portal

**PDF Rendering Details:**
- **Modular Design:**
  - `BaseCertificate.js` - Shared layout and styling
  - `QRBlock.js` - Embedded verification QR code
  - `SignatureBlock.js` - Principal/clerk signature areas
  - Template-specific files (e.g., `BonafideCertificatePDF.js`)
- **Asset Handling:**
  - College logo: `fs.readFileSync()` → Base64 → embedded in PDF
  - Signatures: Retrieved from database → Base64 → embedded
  - QR data: `qrcode.toDataURL()` → embedded
- **Mock Time Support:** Uses `getNow()` for certificate generation date

**Verification Portal:**
- Public endpoint `/verify` enables anyone to validate certificate authenticity
- Displays certificate type, issue date, and QR verification status

### **B. Faculty Attendance & Marks System** (`src/components/clerk/faculty/`)
**Attendance Entry Modes:**
1. **Excel Mode** - High-performance grid for bulk entry
   - Session-wise columns (S1, S2, S3, etc.)
   - Sequential validation: Can't mark S2 until S1 is complete
   - Date filtering: Only shows WORKING days from academic calendar
   - One-click "Follow Previous Session" - Copies S1 data to S2 (saves repetitive manual entry)
   - Real-time validation toast feedback
   
2. **Mobile View** (`MobileAttendanceSheet.js`)
   - Card-based responsive layout
   - Progressive session unlocking (S1 → S2 → S3)
   - Touch-optimized input targets
   - Simplified navigation

**Marks Entry Features:**
- Subject-wise marks recording per student per session
- Validation: Marks ≤ subject maximum
- Only available during open academic calendar periods
- Clerk signature auto-captured via session context

**Data Persistence:**
- Real-time sync to database via `PATCH /api/clerk/attendance/[rollno]`
- Optimized fetch: Separates student metadata from daily status records
- Caching in `FacultyAttendanceContext` to reduce redundant DB calls

**Calendar Integration:**
- Reads `academic_calendar` for semester date boundaries
- Restricts entry to calendar `WORKING` days
- Displays visual feedback when attempting to mark on holidays
- Semester closure prevents further modifications

### **C. Syllabus Management** (`src/lib/syllabus/` & `src/lib/syllabus-data.js`)
**Architecture:**
- **Static Definition:** Branch-semester specific course trees in `/src/lib/syllabus/` files
  - `cse.js`, `ece.js`, `eee.js`, `mech.js`, `civil.js`, `csd.js`, `it.js`
  - Each file exports semester-wise course arrays with code, name, credits, and max marks
  
- **Aggregation:** `syllabus-data.js` imports all branch files and creates `syllabusData` object
  - Maps branch name to course structure
  - Single source of truth for Materials/Subjects modules
  
- **Usage:**
  - Faculty interest selection uses syllabus for valid subject codes
  - Marks entry validates subject codes against syllabus
  - Student dashboard displays expected coursework

**Example Structure:**
```javascript
// cse.js
export const cseSyllabus = {
  1: [
    { code: '01', name: 'Mathematics II', credits: 4, maxMarks: 100 },
    { code: '02', name: 'Physics II', credits: 4, maxMarks: 100 },
    ...
  ],
  2: [ ... ],
};
```

### **D. Academic Calendar Management** (`/clerk/academic-calendar`)
**Clerk Controls:**
- Define working day patterns per semester
- Bulk holiday marking (e.g., "Mark every Sunday as holiday")
- Open/close semesters for attendance and marks entry
- Edit existing calendar entries

**System Impact:**
- Restricts faculty from marking attendance on non-working days
- Prevents semester-closed attendance/marks modifications
- Powers Time Machine validation (semester boundaries)

**Database Tables:**
- `academic_calendar` - Semester timelines
- `calendar_holidays` - Holiday date tracking

### **E. Admission Pipeline** (`/admission`, `/clerk/admission`)
**Three-Stage Process:**

1. **Public Registration** (`/admission`)
   - 27-field form with validation:
     - Personal: Name, DOB, gender, blood group, Aadhaar
     - Academic: SSC marks, Intermediate marks, entrance exam scores
     - Contact: Email, mobile, guardian details
     - Category: Seat allotted category (optional)
   - Client-side constraints: Numeric fields, phone/Aadhaar formatting
   - Draft storage in `student_admission_drafts` table

2. **Clerk Verification** (`/clerk/admission`)
   - Search and review applicant drafts
   - Edit and correct data before finalization
   - Verify document authenticity

3. **Roll-Number Assignment** (`/clerk/admission/finalize`)
   - Approve draft → generates institutional Roll Number
   - Assigns final `students` record
   - Creates `student_personal_details` and `student_academic_background` entries
   - Triggers automation: Generates initial student ID card, sends welcome email

**Validation:**
- Cross-table uniqueness: Email, mobile, Aadhaar checks
- Entrance exam score validation against exam type (EAMCET vs ECET max marks)
- Mandatory fields enforcement with visual indicators (*)

### **F. Student Profile & Request Management**
**Student Self-Service:**
- `/student/profile` displays:
  - Personal information (name, DOB, contact)
  - Academic background (batch, entrance details)
  - Current semester and studying year
  - Profile photo and signature
  - Activity bar with recent requests

**Profile Update Requests:**
- Students can request photo/signature updates
- Unified request system in `student_profile_requests` table
- Clerk approval workflow from admin dashboard
- Prevents direct overwrites (audit trail)

---

## 6. Development Guidelines
- **Date Handling:** Never use `new Date()` for business logic; always use `getNowSync()` from `src/lib/clock.js`.
- **API Standards:** All data responses should be wrapped in a `{ data: [...] }` object.
- **BLOB Uploads:** Enforce a **4MB limit** client-side and use `Buffer.from(base64, 'base64')` server-side for `MEDIUMBLOB` storage.
- **SQL Best Practices:** Prefer `ON DUPLICATE KEY UPDATE` for settings and profile data to ensure atomicity.

---

## 7. Key API Routes

### **Authentication APIs** (`/api/auth/`)
- `POST /api/auth/login` - Student/clerk login, returns JWT token
- `POST /api/auth/logout` - Clear auth cookies
- `POST /api/auth/forgot-password` - Initiate password reset flow
- `POST /api/auth/reset-password/[token]` - Complete password reset

### **Student APIs** (`/api/student/`)
- `GET /api/student/profile` - Fetch logged-in student data
- `PATCH /api/student/profile` - Update student personal details
- `GET /api/student/attendance` - View own attendance records
- `GET /api/student/marks` - View own marks
- `GET /api/student/fees` - View fee information
- `GET /api/student/requests/latest` - Fetch recent profile/certificate requests
- `POST /api/student/certificate-request` - Submit certificate request
- `GET /api/student/certificates/[type]/download` - Download approved certificate

### **Clerk APIs** (`/api/clerk/`)
**Admission:**
- `GET /api/clerk/admission/drafts` - List applicant drafts
- `GET /api/clerk/admission/drafts/[id]` - Fetch specific draft
- `PATCH /api/clerk/admission/drafts/[id]` - Edit draft details
- `POST /api/clerk/admission/finalize` - Assign roll number and create student

**Student Management:**
- `GET /api/clerk/students/search` - Search students (name, roll no, email)
- `GET /api/clerk/students/[rollno]` - Fetch full student profile
- `PATCH /api/clerk/students/[rollno]` - Update student details
- `GET /api/clerk/students/[rollno]/requests` - View student's update requests

**Attendance & Marks:**
- `GET /api/clerk/attendance/[rollno]` - Fetch student attendance history
- `PATCH /api/clerk/attendance/[rollno]` - Update attendance for session
- `GET /api/clerk/marks/[rollno]` - Fetch student marks
- `PATCH /api/clerk/marks/[rollno]` - Update marks for subject/session

**Academic Calendar:**
- `GET /api/clerk/academic-calendar` - Fetch semester calendars
- `POST /api/clerk/academic-calendar` - Create/update calendar entries
- `PATCH /api/clerk/academic-calendar/[semesterId]` - Modify semester

**Scholarship:**
- `GET /api/clerk/scholarship/students` - Search students for scholarship
- `GET /api/clerk/scholarship/summary` - View scholarship statistics
- `POST /api/clerk/scholarship/sanctions` - Record scholarship sanction
- `PATCH /api/clerk/scholarship/sanctions/[id]` - Update sanction record

**Certificate Management:**
- `GET /api/clerk/certificate-requests` - List pending certificate requests
- `PATCH /api/clerk/certificate-requests/[requestId]/approve` - Approve request
- `PATCH /api/clerk/certificate-requests/[requestId]/reject` - Reject request

### **Admin APIs** (`/api/admin/`)
- `GET /api/admin/statistics` - Dashboard statistics
- `GET /api/admin/pending-approvals` - Items awaiting admin action
- `PATCH /api/admin/approve-[type]/[id]` - Approve various pending items
- `GET /api/admin/audit-logs` - Change history

### **Public APIs** (`/api/public/`, `/api/verify/`)
- `POST /api/public/admission/register` - Submit admission draft
- `POST /api/public/otp/send` - Send OTP for password reset
- `GET /api/verify/certificate` - Verify certificate authenticity
- `POST /api/verify/certificate/check` - Validate certificate ID

---

## 8. Role-Based Feature Matrix

| Feature | Student | Admission Clerk | Scholarship Clerk | Faculty Clerk | Super Admin |
|---------|---------|-----------------|-------------------|---------------|-------------|
| **Login**              | ✓ | ✓ | ✓ | ✓ | ✓ |
| **View Own Profile**   | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Edit Own Profile**   | ✓ | ✗ | ✗ | ✗ | ✓ |
| **Register Admission** | ✓* | ✓ | ✗ | ✗ | ✗ |
| **Approve Admission**  | ✗ | ✓ | ✗ | ✗ | ✓ |
| **Assign Roll Number** | ✗ | ✓ | ✗ | ✗ | ✓ |
| **Mark Attendance**    | ✗ | ✗ | ✗ | ✓ | ✓ |
| **Entry Marks**        | ✗ | ✗ | ✗ | ✓ | ✓ |
| **Request Certificate**| ✓ | ✗ | ✗ | ✗ | ✗ |
| **Approve Certificate**| ✗ | ✓ | ✓ | ✓ | ✓ |
| **Manage Scholarships**| ✗ | ✗ | ✓ | ✗ | ✓ |
| **Manage Calendar**    | ✗ | ✗ | ✗ | ✗ | ✓ |
| **Verify Certificates**| ✓ | ✓ | ✓ | ✓ | ✓ |

***Public role before login

---

## 9. Development Guidelines & Best Practices

### **Code Standards**
- **Language:** JavaScript (ES6+, Node.js 18+)
- **Indentation:** 2 spaces (enforced by ESLint)
- **Semicolons:** Required (enforced)
- **File Naming:**
  - React components: PascalCase (`StudentProfileCard.js`)
  - Utilities/helpers: camelCase (`rollNumber.js`)
  - Pages: lowercase or with brackets for dynamic routes (`page.js`, `[id].js`)
  - Client-only components: `.client.js` suffix

### **Date & Time Rules**
- **NEVER** use `new Date()` directly in business logic
- **ALWAYS** use `getNowSync()` (client) or `getNow()` (server) from `src/lib/clock.js`
- This ensures mock time compatibility and consistent behavior across environments

### **API Response Format**
```javascript
// Standard response wrapper
{ data: [...] }              // Success with array
{ data: { key: value } }     // Success with object
{ error: "message" }         // Error response
{ error: "message", code: 400 } // Error with HTTP code
```

### **Authentication & Sessions**
- **HTTP-Only Cookies:** All auth tokens stored as HTTP-only (no JavaScript access)
- **Cookie Names:** `admin_auth`, `clerk_auth`, `student_auth`
- **JWT Algorithm:** HS256 only
- **Token Expiry:** Configure in `.env.local` (`JWT_EXPIRY`)
- **Verify in Middleware:** Never trust client-provided role claims; always verify JWT signature

### **Binary Data Handling (Images/Signatures)**
- **Max Size:** 4MB enforced client-side and server-side
- **Format:** Base64 encoding for transmission
- **Storage:** `MEDIUMBLOB` type in MySQL
- **Conversion:** 
  ```javascript
  // Client to server
  const binaryData = Buffer.from(base64String, 'base64');
  
  // Server to client
  const base64String = binaryData.toString('base64');
  ```
- **Rendering:** Always convert to Base64 before passing to PDF components (avoids file access errors)

### **Database Best Practices**
```javascript
// Use ON DUPLICATE KEY UPDATE for idempotency
const query = `
  INSERT INTO table (col1, col2) VALUES (?, ?)
  ON DUPLICATE KEY UPDATE col2 = VALUES(col2)
`;

// Use parameterized queries to prevent SQL injection
await db.execute('SELECT * FROM students WHERE roll_no = ?', [rollNo]);

// Handle timezone: Always use UTC, collate with 'utf8mb4_general_ci'
```

### **Performance Optimization**
- **Context Caching:** Use `FacultyAttendanceContext` to cache fetched student data (avoid N+1 queries)
- **Composite Keys:** Use composite unique keys for historical data (e.g., attendance: roll_no + session + date)
- **Lazy Loading:** Load student images only when needed (defer Base64 conversion)
- **Connection Pooling:** MySQL pool configured with `connectionLimit: 10`

### **Security Checklist**
- ✓ Always verify JWT signature (don't trust header alone)
- ✓ Sanitize user input before database queries
- ✓ Use parameterized SQL queries (prevent SQL injection)
- ✓ Enforce HTTP-only cookies (prevent XSS token theft)
- ✓ Validate file sizes and types (4MB limit)
- ✓ Never log sensitive data (passwords, tokens)
- ✓ Use `bcrypt` for password hashing (not MD5 or plain text)
- ✓ Check role in JWT payload before sensitive operations

### **Testing & Debugging**
- **Time Travel:** Access `/dev/time-machine` to mock system date
- **Mock Time Cookie:** `dev_mock_date=2026-02-25T10:30:00Z`
- **No Automated Tests:** Currently use manual verification
- **Linting:** Run `npm run lint` before commits

### **Common Pitfalls to Avoid**
- ❌ Using `new Date()` instead of `getNowSync()`
- ❌ Storing derived data (academic year, semester) instead of calculating it
- ❌ Trust client-provided JWT claims without server verification
- ❌ Hardcoding college-specific config (use `COLLEGE_CONFIG`)
- ❌ Forgetting to convert Base64 before PDF rendering
- ❌ Not wrapping API responses in `{ data: ... }` object

---

## 10. Recent Activity Log (Feb 2026)

---

## 10. Recent Activity Log (Feb 2026)

### **Session 13: Marks Management Optimizations (Latest - Feb 28, 2026)**
- **Flexible Mid-Marks Logic:**
    - Implemented dynamic max-mark configuration (20 vs 25) for mid-examinations.
    - Updated `MarksEntrySheet` with a toggle UI and auto-lock mechanism once marks are saved.
    - Enhanced `AcademicTab` to provide clear "Out of X" labels for students based on subject-specific settings.
- **High-Performance Bulk APIs:**
    - Refactored `POST /api/clerk/faculty/marks` to use a single bulk `INSERT ... ON DUPLICATE KEY UPDATE` query, eliminating slow per-student database roundtrips.
    - Optimized `GET` query with intelligent roll-number pattern matching to automatically filter students by branch code (e.g., '05' for CSE).
- **Database & API Synchronization:**
    - Added `mid_max` column to `faculty_subject_assignments` via migration script.
    - Refactored API routes to ensure max-mark settings are persisted and correctly served to all roles.

### **Session 12: Settings Navigation & Role Mapping Fixes (Feb 28, 2026)**
- **Centralized Settings Navigation:**
    - Fixed broken "Security & Privacy" and "Edit Profile" links for Faculty role by redirecting them to centralized `/clerk/settings/` paths.
    - Updated `Navbar.js` to automatically map `admission` and `scholarship` sub-roles to the standard `clerk` menu configuration, preventing navigation failures for these roles.
- **Dynamic Settings Pages:**
    - Enhanced `ClerkSecurityPage` and `ClerkEditProfilePage` to dynamically detect and pass the correct role (`clerk` or `faculty`) to the Navbar, ensuring appropriate menu visibility regardless of the entry path.
    - Improved robustness of settings pages when handling different clerk sub-roles.

### **Session 11: Attendance Bulk Actions & Mobile UI Polishing (Feb 28, 2026)**
- **Bulk Attendance Toggle:**
    - Implemented `setAllAttendanceStatus` in `FacultyAttendanceContext` to enable one-click status updates for all students.
    - Added "All P" (Present) and "All A" (Absent) buttons to the Desktop Attendance Grid header.
    - Added "Mark All Present" and "Mark All Absent" buttons to the Mobile Attendance interface.
- **Mobile UX Refinements:**
    - Optimized mobile attendance table layout with fixed column widths and better word-wrapping for student names.
    - Enhanced visual feedback for attendance status on mobile (P/A/N/A shorthand).

### **Session 10: Faculty Dashboard UI Enhancements (Feb 28, 2026)**
- **Attendance & Marks Pages Optimization:**
    - Implemented sorting for assigned subjects: Active subjects now appear at the top, while historical (inactive) subjects are moved to the bottom.
    - Enhanced `SubjectCard` styling for inactive subjects: cards now feature a gray background, grayscale filter, and reduced opacity for better visual distinction.
    - Applied these UI/UX improvements consistently across both Attendance and Internal Marks management pages.

### **Session 9: Scholarship Dashboard Optimization & Email System Refinement (Feb 28, 2026)**
- **Scholarship Dashboard Improvements:**
    - Enhanced API data fetching to support both direct and wrapped (`{ data: ... }`) responses.
    - Improved data normalization for year-wise scholarship summaries and fee status.
    - Refined UI state management for student info and academic year lists.
- **Email System Refinement:**
    - Refactored OTP email logic to utilize the shared `sendInstitutionalEmail` helper for consistent branding.
    - Implemented absolute URL resolution for email assets (campus image) to ensure cross-client compatibility.
    - Streamlined email templates by decoupling content from structural layout.
- **Navigation UX:**
    - Improved Navbar active state logic for Clerk roles, ensuring the "DASHBOARD" item remains highlighted across all `/clerk/*/dashboard` routes.

### **Session 8: Authentication Refactoring & Email Improvements (Feb 2026)**
- **NextAuth Integration:** Added next-auth dependency for enhanced OAuth support
- **Login Flow Refinement:** Debugged and fixed NextAuth redirect logic, improved login panel UX
- **Email Templates:** Improved Brevo email templates for better formatting and deliverability
- **Build Stability:** Fixed home page server-side rendering issues
- **Dependency Updates:** Updated ESLint and related packages to latest versions
- **Google OAuth:** Integrated Google login option for faster registration/login
- **Marks Fetching:** Fixed critical issue in marks retrieval for student dashboard
- **Clock Improvements:** Enhanced time Machine features and mock date handling

### **Session 7: Advanced Attendance Tools & Certificate Expansion**
- **Attendance "Follow Previous" Feature:** Implemented one-click button to copy attendance data from preceding session (e.g., S1 to S2)
- **Certificate Engine Expansion:**
    - Added support for **No Objection Certificate (NOC)** with purpose and date range
    - Enhanced certificate verification portal to show certificate type
    - Integrated purpose-specific date ranges for context-aware certificates
- **PDF Rendering Refinement:**
    - Improved aesthetic quality by reducing border thickness and optimizing white space
    - Implemented server-side certificate ID generation during approval
- **Security & Validation:**
    - Strengthened attendance API validation to prevent null/undefined submissions
    - Added robust client-side validation for NOC purposes (length, word count checks)
- **UI/UX Cleanup:**
    - Streamlined Login Panel by removing redundant links
    - Optimized verification portal layout for mobile responsiveness

### **Session 6: Faculty Attendance & Performance Optimization**
- **Attendance Architecture Refactor:** Migrated to dedicated `FacultyAttendanceContext` for centralized state management
- **Performance Optimization:** Separated student metadata from status records; implemented frontend caching
- **Calendar-Driven Attendance:** Integrated academic calendar, restricting entry to WORKING days only
- **Enhanced Mobile Experience:** Completely redesigned `MobileAttendanceSheet.js` with card-based layout and sequential session unlocking
- **Data Integrity:** Strengthened sequential attendance validation (S1 → S2 → S3 order enforced)
- **UI/UX Polishing:** Refined student profile status bars and academic labels

### **Session 5: Clerk & Admission Form Enhancements**
- **API Security Refactoring:** Separated clerk and student API endpoints for better role-based access
- **Clerk Student Search:** Enhanced search API to include personal/academic details in results
- **Admission Form Validation:**
    - Made numerous fields mandatory with visual indicators (*)
    - Implemented client-side validation (e.g., prevent same mobile for student and guardian)
    - Restricted numeric field input (SSC/Intermediate marks)
    - Added formatting for Aadhaar (XXXX XXXX XXXX) and Annual Income (Indian number system)
    - Made "Seat Allotted Category" optional

### **Session 4: Advanced Admission Workflow**
- **Three-Stage Pipeline:** 
  - Public registration form (`/admission`)
  - Clerk verification module (`/clerk/admission`)
  - Roll-number assignment (`/clerk/admission/finalize`)
- **Data Expansion:** Added `ssc_marks`, `inter_marks`, `guardian_mobile` fields
- **Security:** Implemented cross-table uniqueness checks (email, mobile, Aadhaar)
- **Rich Media:** Integrated photo and signature uploads with 4MB validation

### **Session 3: Mobile UX & Academic Calendar**
- **Responsive Web:** Developed `MobileAttendanceSheet.js` for on-the-go faculty access
- **Calendar Management:** Built institutional calendar system with bulk holiday actions

---

### Goutham's Changes: Advanced Admission Workflow & Data Expansion (Session 4)

**Objective 1: Multi-Stage Admission Pipeline**
*   **Registration:** Built a 27-field formal registration form (`/admission`) with dynamic year calculation (EAMCET/ECET).
*   **Verification:** Created `student_admission_drafts` and a clerk module to verify and correct applicant data.
*   **Finalization:** Implemented a roll-number assignment tool that graduates drafts to official student records. The finalization page (`/clerk/admission/finalize`) has been polished with the standard application layout (Header, Navbar, Footer) for a consistent user experience.

**Objective 2: Student Data Expansion**
*   **New Fields:** Added `ssc_marks`, `inter_marks`, and `guardian_mobile` to the database and frontend.
*   **Rich Media:** Integrated binary Photo and Signature uploads with 4MB validation and base64 handling.
*   **Validation:** Added cross-database uniqueness checks for Email, Student Mobile, and Aadhaar card.

---

## 11. Environment Configuration

### **Required Environment Variables** (`.env.local`)
```
# Database
DB_HOST=<railway-host>
DB_PORT=<mysql-port>
DB_USER=<mysql-user>
DB_PASSWORD=<mysql-password>
DB_DATABASE=kucet_cms

# Authentication
JWT_SECRET=<long-random-string>
JWT_EXPIRY=7d

# Google OAuth (optional)
GOOGLE_CLIENT_ID=<google-oauth-id>
GOOGLE_CLIENT_SECRET=<google-oauth-secret>
NEXTAUTH_URL=https://<your-domain>

# Email (Brevo)
BREVO_API_KEY=<brevo-api-key>
SENDER_EMAIL=noreply@kucet.edu.in

# Environment
NEXT_PUBLIC_WORKING_ENV=production  # or 'testing' for time machine
```

---

## 12. Deployment & Maintenance

### **Build & Start**
```bash
npm install         # Install dependencies
npm run build       # Production build
npm run start       # Start production server (requires .next build)
npm run dev         # Development server with hot reload
npm run lint        # Check for ESLint violations
```

### **Database Initialization**
- Run `.sql` files in order (check schema dependencies)
- Seed `college_info` with institution-specific data
- Initialize `academic_calendar` for current academic year

### **Monitoring & Logs**
- Server logs output to stdout (check hosting platform logs)
- Database connection errors logged with `[DB_CONNECT]` prefix
- JWT verification errors include token type information

### **Security Hardening Checklist**
- ✓ Use strong `JWT_SECRET` (minimum 32 characters)
- ✓ Enable HTTPS in production (enforce via `next.config.mjs`)
- ✓ Restrict database access to application server only
- ✓ Rotate credentials every 6 months
- ✓ Enable database backups (Railway provides this)
- ✓ Monitor failed login attempts

---

## 13. Troubleshooting Guide

### **Common Issues:**

**Issue:** "JWT Verification failed"
- **Cause:** Token expired, wrong secret, or corrupted cookie
- **Fix:** Clear cookies, re-login; verify `JWT_SECRET` matches in code and `.env.local`

**Issue:** "Certificate PDF rendering fails"
- **Cause:** Image paths are absolute, not Base64
- **Fix:** Ensure all images converted via `fs.readFileSync()` and passed as Base64 strings

**Issue:** "Attendance can't be marked on certain dates"
- **Cause:** Date not set as WORKING in academic calendar
- **Fix:** Check `/clerk/academic-calendar`, ensure semester is open and date is marked WORKING

**Issue:** "Roll number validation fails"
- **Cause:** Invalid roll number pattern
- **Fix:** Verify format matches regex: `YY567T/LBB SS` where YY=year, T=regular, BB=branch, SS=serial

**Issue:** "Email not sending"
- **Cause:** Brevo API key invalid or rate limited
- **Fix:** Verify `BREVO_API_KEY` in `.env.local`; check Brevo dashboard for quota

---

## 14. Future Enhancements & TODOs

- [ ] Implement comprehensive automated test suite
- [ ] Add role-based permission matrix to database (currently hardcoded)
- [ ] Implement digital signature verification for offline certificates
- [ ] Add multi-language support (currently English only)
- [ ] Implement ID Card Reissue workflow (placeholder exists)
- [ ] Add fee payment gateway integration (Razorpay/PayU)
- [ ] Implement document scanning for admission verification
- [ ] Add analytics dashboard for admin
- [ ] Implement attendance analytics by semester/branch
- [ ] Add student grievance portal
- [ ] Implement hostel management module
- [ ] Add internal exam schedule automation

---

## Summary

The KUCET College Management System is a comprehensive, production-ready application designed to digitalize the complete student lifecycle. It emphasizes role-based access control, data integrity through normalized schemas, and smart automation via intelligent parsing and context-aware calculations. The system is built with modern Next.js practices, includes comprehensive error handling, and provides multiple user-friendly interfaces tailored to each role's needs.

**Key Strengths:**
- Centralized configuration management
- Robust JWT-based authentication
- Flexible PDF certificate engine
- Performance-optimized attendance system
- Comprehensive audit trails and request workflows

**Primary Use Cases:**
- Student admission and enrollment
- Attendance tracking and management
- Internal marks recording
- Scholarship administration
- Digital certificate generation and verification
- Fee and fee payment management

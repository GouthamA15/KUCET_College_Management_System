# KUCET College Management System - Technical Documentation

## 1. Project Overview
A robust, centralized web application built with **Next.js** for managing the complete academic lifecycle at KUCET. The system supports three primary user roles: **Super Admin**, **Clerk/Faculty**, and **Student**. It automates complex processes including admissions, attendance, internal marks, scholarship management, and digital certificate generation.

---

## 2. Technical Stack
- **Frontend:** Next.js 16.1.6, React 19.2.4, Tailwind CSS.
- **Backend:** Next.js API Routes (App Router).
- **Database:** MySQL (hosted on Railway, accessed via `mysql2/promise`).
- **Auth:** JWT-based authentication using `jsonwebtoken` and `jose` (Edge-compatible).
- **PDF Engine:** Custom template-based PDF generation using `@react-pdf/renderer`.
- **Utilities:** `bcrypt` for hashing, `react-hot-toast` for notifications, `react-datepicker` for formal inputs.

---

## 3. Core Architectural Concepts

### A. Middleware & Route Protection (`src/proxy.js`)
- **Technology:** Uses `jose` library for Edge-runtime compatible JWT verification (replacing standard `jsonwebtoken` which fails in edge middleware).
- **Logic:** Intercepts requests to protected paths (`/admin`, `/clerk`, `/student`). Decodes the HTTP-only cookie, verifies the signature using `HS256`, and redirects unauthorized users to `/`.
- **Sub-Role Enforcement:** Clerk routes are further guarded; e.g., `/clerk/admission` is accessible only if the JWT payload contains `role: 'admission'`.

### B. Global State Management (`src/context/`)
- **StudentContext:** Tracks student identity, profile completion, and pending requests.
- **ClerkContext:** Manages clerk profile, role (admission/scholarship/faculty), and pending tasks.
- **AdminContext:** Provides global statistics and administrative control state.

### C. Time Management & The "Time Machine"
- **Authoritative Clock:** `src/lib/clock.js` provides `getNow()` to ensure server-side consistency.
- **Dev Tool:** `/dev/time-machine` allows developers to mock the system date, enabling testing of date-dependent logic like semester transitions and attendance "graying out."

### D. Academic Intelligence (`src/lib/rollNumber.js`)
- **Regex-Based Parsing:** Decodes entrance year, branch, and admission type (Regular/Lateral) directly from roll numbers using patterns like `/^(\d{2})567T(\d{2})(\d{2})$/`.
- **Dynamic Logic:** Calculates batch years, current studying semester, and effective academic years based on institution-specific boundaries.

---

## 4. Database Schema

### **1. Core Identity & Auth**
- `students`: Core records including `roll_no`, `email`, and `password_hash`.
- `clerks`: Administrative staff records with `role` (admission, scholarship, faculty).
- `principal`: Auth for principal-level approvals.
- `otp_codes` & `password_reset_tokens`: Security flow data.

### **2. Academic & Attendance**
- `student_admission_drafts`: Holds applicant data before roll number assignment.
- `student_academic_background`: Stores SSC, Inter/Diploma marks, and entrance ranks.
- `student_attendance`: Multi-session (S1-S5) daily tracking with composite unique keys.
- `student_marks`: Mid-exam performance and internal assignments.

### **3. Student Records & Media**
- `student_personal_details`: Extended info including Aadhaar, guardian contact, and identification marks.
- `student_images` & `student_signatures`: Binary BLOB storage for profile media.
- `student_profile_requests`: Unified request table for student-initiated photo/signature updates.

### **4. Finance & Scholarship**
- `student_fee_payments`: Records of tuition and other fees.
- `scholarship_sanctions`: Tracking of government-provided reimbursements and amounts.

---

## 5. Specialized Modules

### **A. Digital Certificate Engine (`src/pdf/` & `src/app/api/.../download`)**
- **Server-Side Rendering:** Uses `@react-pdf/renderer`'s `pdf().toBuffer()` method to generate binary streams on the server.
- **Asset Handling:** Local images (logos, signatures) are converted to Base64 strings (`fs.readFileSync`) before being passed to the React-PDF template to prevent file access errors during rendering.
- **Security:** Generates a unique Certificate ID using `HMAC-SHA256` of the roll number and certificate type.
- **Templates:** Modular React components (`BonafideCertificatePDF.js`, etc.) assembled from shared blocks (`QRBlock`, `SignatureBlock`).

### **B. Faculty Performance Grid**
- **Excel Mode:** High-performance matrix for bulk attendance/marks entry with sequential validation (prevents marking Session 2 if Session 1 is empty).
- **Responsive View:** `MobileAttendanceSheet.js` provides a card-based alternative for smartphones.

### **C. Syllabus Aggregation (`src/lib/syllabus-data.js`)**
- **Static Definition:** Syllabus structures are defined as static JS objects in `src/lib/syllabus/`.
- **Aggregation:** `syllabus-data.js` imports and maps these definitions by branch (CSE, ECE, etc.), acting as the single source of truth for the "Materials" module.

### **D. Institutional Academic Calendar**
- **Control:** Clerks define working days, holidays, and Sundays per semester.
- **Impact:** Automatically restricts attendance entry on non-working days.

---

## 6. Development Guidelines
- **Date Handling:** Never use `new Date()` for business logic; always use `getNowSync()` from `src/lib/clock.js`.
- **API Standards:** All data responses should be wrapped in a `{ data: [...] }` object.
- **BLOB Uploads:** Enforce a **4MB limit** client-side and use `Buffer.from(base64, 'base64')` server-side for `MEDIUMBLOB` storage.
- **SQL Best Practices:** Prefer `ON DUPLICATE KEY UPDATE` for settings and profile data to ensure atomicity.

---

## 9. Recent Activity Log (Feb 2026)

### **Session 4: Advanced Admission Workflow (Latest)**
- **Draft Pipeline:** Created `/admission` public form and clerk verification/finalization modules.
- **Data Expansion:** Added `ssc_marks`, `inter_marks`, and `guardian_mobile` fields.
- **Security:** Implemented cross-table uniqueness checks for system-wide data integrity.

### **Session 3: Mobile UX & Academic Calendar**
- **Responsive Web:** Developed `MobileAttendanceSheet.js` for on-the-go faculty access.
- **Calendar Management:** Built the institutional calendar system with bulk holiday actions.

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

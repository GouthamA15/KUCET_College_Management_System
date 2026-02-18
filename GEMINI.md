# KUCET College Management System - Technical Documentation

## 1. Project Overview
A modern web interface built with **Next.js** for managing college academic data. The system handles three distinct user roles: **Super Admin**, **Clerk/Faculty**, and **Student**. It features real-time attendance tracking, internal marks management, scholarship processing, and certificate generation.

---

## 2. Technical Stack
- **Frontend:** Next.js 16.1.6, React 19.2.4, Tailwind CSS.
- **Backend:** Next.js API Routes (App Router).
- **Database:** MySQL (using `mysql2/promise`).
- **Auth:** `jsonwebtoken` (JWT), `bcrypt` (Hashing), `jose` (Edge-compatible JWT).
- **PDF Engine:** `@react-pdf/renderer` for template-based certificate generation.
- **Email:** Brevo HTTP API (Port 443) for firewall-proof OTP delivery.

---

## 3. Core Architectural Concepts

### A. Authentication & Role-Based Access Control (RBAC)
- **Middleware Logic:** Managed via `src/proxy.js`. It intercepts requests to `/admin`, `/clerk`, and `/student`, verifying the corresponding HTTP-only cookie (`admin_auth`, `clerk_auth`, `student_auth`).
- **JWT Payload:** Includes `student_id`/`clerkId`, `roll_no`, `name`, and `role`.
- **Clerk Roles:** Sub-roles include `admission`, `scholarship`, and `faculty`.

### B. Time Management & Mocking (Time Machine)
- **Authorized Source:** `src/lib/clock.js` provides `getNow()` (Async/Server) and `getNowSync()` (Sync/Client).
- **Mocking:** In development, setting a `dev_mock_date` cookie allows the entire application to "travel" to a different date.
- **Safe Mode:** Mock logic is automatically disabled if `NEXT_PUBLIC_WORKING_ENV !== 'testing'`.

### C. Academic Lifecycle & Semester Transitions
- **Boundaries:** Defined in `college_info` table (First Sem Start, Second Sem Start).
- **Transition Logic:** `src/lib/academic-utils.js` determines the current Academic Year and Semester (Odd/Even) based on the "Current Date" (Real or Mocked).
- **Lifecycle Locking:** Subjects from ended semesters automatically move to **History Mode** (Read-Only/Grayed out) in both UI and API.

---

## 4. Database Schema (`faculty_features.sql`)

### **Faculty & Assignments**
- `faculty_subject_interests`: Stores subjects faculty want to teach.
- `faculty_subject_assignments`: Official records of approved subjects per branch/semester/AY.
- **Note:** "Section" logic has been removed; the system assumes a single class per branch.

### **Academic Records**
- `student_attendance`: Tracks daily attendance.
    - **Multi-Session:** Includes a `session` column (1-5) to handle multiple lectures per day.
    - **Unique Constraint:** Composite key on `(student_id, assignment_id, date, session)`.
- `student_marks`: Tracks internal performance.
    - **Formula:** Internal Total (30) = `Math.max(Mid1, Mid2) + Assignment`.

---

## 5. Key Module Documentation

### **Faculty Management Module**
- **Dashboard:** Clearly separates "Active Assignments" from "Subject History" (Ended semesters) based on current chronological time.
- **Daily View:** 
    - **Dynamic Session Selector:** Replaces static slots with interactive session tokens (S1-S5).
    - **Sequential Enforcement:** Sessions must be filled in order (Session 2 is disabled until Session 1 is recorded).
    - **Bulk Mode:** Option to mark attendance for multiple sessions simultaneously.
- **Excel Mode (Grid):** 
    - **Interactive Matrix:** High-performance grid for bulk editing. Columns sorted in Ascending order (Oldest -> Newest).
    - **Protected Column Actions:** Header buttons to "Mark All Present/Absent" for an entire session, which are automatically disabled if the preceding session is incomplete.
    - **Manual Insertion:** Feature to add custom Date/Session columns with smart logical defaults and strict sequential verification (e.g., prevents adding Session 2 if Session 1 is missing).
    - **Cell-Level Sequence:** Enforces that a student's Session N cannot be marked if N-1 is empty.
- **Student History Modal:** Polished UI with a summary section and a "Save Changes" workflow for bulk persistence.

### **Student Performance Module**
- **Live Tab:** "Attendance / Mid Marks" shows current subjects and faculty names.
- **Regularity Stats:** Real-time percentage calculation with color urgency:
    - 🔴 Red: ≤ 50%
    - 🟠 Orange: ≤ 75%
    - 🟢 Green: > 75%
- **Self-History:** Modal access to personal daily logs, now including Session numbers (S1, S2, etc.).

### **Student Profile & Signature Management**
- **Workflow:** Every signature and profile picture update requires mandatory **Admission Clerk** approval.
- **Student UI:** 
    - Dedicated signature and photo upload section in the Edit Profile page (`/student/settings/edit-profile`).
    - Real-time status indicators for "Pending Approval" or "Rejected" requests.
    - Feedback loop: Displays clerk-provided rejection reasons directly to the student for immediate correction.
- **Clerk UI:** 
    - "Student Requests" module in the Admission Dashboard (`/clerk/admission/student-requests`).
    - Side-by-side comparison of old vs. new data (Photos and Signatures) for quick verification.
    - Rejection workflow with mandatory reason description.
- **Database:** Managed via `student_signatures`, `student_images`, and `student_profile_requests` (unified request table).

### **Admin Faculty Management**
- **Decision Engine:** Centralized academic logic ensures admins see all current and pending subject interests across all semesters.

---

## 9. Recent Activity Log (Feb 2026)

### **Session 1: Profile & Signature Request Workflow**
- **Unified Request System:** Implemented a single table `student_profile_requests` to handle both signature and profile picture updates.
- **Student Dashboard:** Updated the Edit Profile page to support file uploads for signatures and photos, with a status tracking badge.
- **Clerk Interface:** Built the Student Requests management page for Admission Clerks to review and process updates.
- **API Implementation:** Created consolidated endpoints for student submission and clerk management.

### **Session 2 (Current): Fixes, Standardization & Request History**
- **Bug Fix:** Resolved `ER_BAD_NULL_ERROR` in `student_profile_requests` by making `new_signature` and `new_pfp` nullable (allowing independent updates).
- **Naming Standard:** Synchronized naming conventions to "Student Requests" across UI and API for the Clerk role.
- **Navbar Update:** Added "Profile Updates" link to the student REQUESTS menu and fixed Clerk Navbar rendering.
- **Request History:** Created a dedicated page for students to view their profile/signature update history (`/student/requests/profile-updates`) with a corresponding API.
- **SQL Consolidation:** Created `final_signature_fix.sql` to simplify database setup and fixes.
- **Documentation:** Updated technical documentation to reflect the unified profile management system.

---

## 6. Developer Tools

### **The Time Machine (`/dev/time-machine`)**
- Allows testing of date-specific features (e.g., verifying that a subject "grays out" exactly on the semester end date).
- **Presets:** Quick travel to start/mid semester dates.
- **Indicator:** A red pulsing "Testing Mode" badge on the homepage allows instant access.

---

## 7. Configuration & Environment

### **Prerequisites**
- Node.js (Latest LTS recommended).
- MySQL Server.

### **Environment Variables (.env.local)**
```dotenv
DB_HOST=...
DB_PORT=...
DB_USER=...
DB_PASSWORD=...
DB_DATABASE=...
JWT_SECRET=...
NEXT_PUBLIC_WORKING_ENV=testing  # 'testing' or 'production'
NEXT_PUBLIC_BASE_URL=...
BREVO_API_KEY=...
EMAIL_USER=...
```

---

## 8. Gemini CLI Usage Guidelines
- **Date Checks:** Never use `new Date()` directly for business logic. Always use `getNow()`/`getNowSync()` from `@/lib/clock`.
- **API Responses:** All new data arrays must be wrapped in `{ data: [...] }`.
- **SQL Updates:** Use bulk inserts for high-traffic tables like `student_attendance`.
- **Production Safety:** Always verify that `NEXT_PUBLIC_WORKING_ENV` is respected before adding debug routes.

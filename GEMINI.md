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

### **Academic Calendar Module**
- **Clerk Management:** Dedicated interface for Clerks to define institutional working days and holidays.
- **Monthly Grid:** Interactive calendar grid with color-coded day statuses (Working, Holiday, Sunday).
- **Sequential Validation:** Prevents a day from being both a holiday and a working day.
- **Bulk Sundays:** One-click feature to mark all Sundays in a month as holidays.

---

## 9. Recent Activity Log (Feb 2026)

### **Session 3: Mobile UX & Academic Calendar (Latest)**
- **Responsive Attendance:** Implemented `MobileAttendanceSheet.js` with a card-based layout and optimized controls for faculty on mobile devices.
- **Academic Calendar:** Built a complete calendar management system for Clerks, including UPSERT APIs and an interactive grid UI.
- **Global Navigation:** Added "ACADEMIC CALENDAR" to the Clerk Navbar.

### **Session 2: Fixes, Standardization & UI Enhancements**
- **Bug Fix:** Resolved `ER_BAD_NULL_ERROR` in `student_profile_requests` by making `new_signature` and `new_pfp` nullable.
- **Naming Standard:** Synchronized naming conventions to "Student Requests" across UI and API.
- **Context Integration:** Updated `StudentContext` and `ClerkContext` for real-time profile request tracking.

### **Session 1: Profile & Signature Request Workflow**
- **Unified Request System:** Implemented a single table `student_profile_requests` for signature and photo updates.
- **Clerk Interface:** Built the Student Requests management page for Admission Clerks.

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
---

### Goutham's Changes: Implement Mobile Attendance View & Academic Calendar (Session 3)

**Objective 1: Mobile-Responsive Attendance**
*   **Mobile View:** Created `MobileAttendanceSheet.js` for faculty to manage attendance via a card-based layout on small screens.
*   **Dynamic Switch:** Added screen-size detection in `src/app/clerk/faculty/attendance/page.js` to toggle between desktop and mobile versions.
*   **Optimized UI:** Replaced tables with student cards and full-width session/action buttons for touch interfaces.

**Objective 2: Institutional Academic Calendar**
*   **Clerk Interface:** New page `/clerk/academic-calendar` for semester scheduling.
*   **Calendar Logic:** Built a standard grid with color coding for Sundays, holidays, and working days.
*   **Efficiency:** Bulk action to mark all Sundays as holidays and UPSERT logic for persistent storage.

---

### Goutham's Changes: Refactor Faculty Attendance Page Architecture (Session 2)

**Objective:** Redesigned the Faculty Attendance page to shift from a filter-based subject selection to an assignment-driven model.

**Key Changes Implemented:**
*   **Subject Selection:** Removed dropdown filters; implemented a direct grid of assigned subjects for faculty.
*   **Identity Panel:** Introduced a formal "Attendance Register" block showing subject and academic year details.
*   **Control Layout:** Restructured Date/Session/Action buttons into clean, logical sections.
*   **Grid Enhancements:** Fixed Roll No/Name columns (sticky) and added a status legend (P/A/×/+) for the Excel-style view.
*   **Validation:** Preserved backend sequential session enforcement while improving visual clarity.

This refactoring focused on architectural and UX improvements to provide an institutional, assignment-driven experience.

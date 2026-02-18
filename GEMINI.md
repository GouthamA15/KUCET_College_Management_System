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

### **Admin Faculty Management**
- **Decision Engine:** Centralized academic logic ensures admins see all current and pending subject interests across all semesters.

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

### Goutham's Changes: Refactor Faculty Attendance Page Architecture

**Objective:** Redesigned the Faculty Attendance page to shift from a filter-based subject selection to an assignment-driven model, reflecting a government-level academic control system.

**Key Changes Implemented:**

*   **Subject Selection Layer (Phase 1):**
    *   Removed academic year, branch, semester, and subject dropdown filters from the main attendance page.
    *   Implemented a new UI displaying a grid of subjects assigned to the logged-in faculty.
    *   Each subject card shows Subject Name, Subject Code, Branch, Semester, Academic Year, and Status (Active/Inactive).
    *   Faculty now select a subject directly from this list to manage attendance.
    *   A message is displayed if no subjects are assigned.

*   **Subject Identity Panel (Phase 2):**
    *   Introduced a formal "Attendance Register" identity block that appears once a subject is selected.
    *   This block displays the selected subject's Name, Code, Branch, Semester, Academic Year, and Status in an institutional, structured layout.

*   **Attendance Control Section (Phase 3):**
    *   Refactored the daily view controls to separate the Date selector, Session selector, and Save/Delete action buttons into distinct, well-organized sections. This avoids a crowded interface.

*   **Daily View Table Refinements (Phase 4):**
    *   Enhanced the styling of the daily attendance table. Table headers now use uppercase, a smaller font, strong grid lines, and consistent padding for a more official appearance.
    *   Status badges for student attendance are now flat, minimal, and official-looking, replacing overly rounded pills and excessive hover animations.

*   **Excel Mode Structure Enhancements (Phase 5):**
    *   Added a clear legend above the grid for status indicators: `P = Present`, `A = Absent`, `× = Locked (Previous session missing)`, `+ = Not Marked`.
    *   Introduced an official heading: "Attendance Register – [Subject Name]" with "Academic Year: [AY]".
    *   Ensured Roll No and Name columns remain visually frozen (sticky) for improved usability in the grid view.
    *   The backend sequential validation for sessions remains preserved.

*   **Back Navigation (Phase 6):**
    *   Implemented a prominent "← Back to Subjects" button for easy navigation back to the subject selection screen.

*   **Removal of Old Filter Model (Phase 7):**
    *   Completely eliminated the previous dropdown-based filter system.

**Unaltered Aspects (as per instructions):**

*   API endpoints were not changed.
*   Sequential validation logic was preserved.
*   Attendance backend logic was not modified.
*   Database schema was not altered.
*   Other faculty pages were not affected.

This refactoring strictly focused on architectural and UX-level improvements to provide an institutional, assignment-driven attendance management experience.

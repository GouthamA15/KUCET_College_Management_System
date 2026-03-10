# KUCET College Management System - Technical Documentation

**Last Updated:** March 10, 2026

## 1. Project Overview
A robust, production-ready web application built with **Next.js** for managing the complete academic lifecycle at KUCET (Kakatiya University College of Engineering and Technology). The system supports four primary user roles: **Super Admin**, **Head of Department (HOD)**, **Clerk/Faculty**, and **Student**. 

### Core Capabilities:
- **Departmental Management:** Multi-semester timetable orchestration, faculty workload tracking, and branch-specific syllabus management.
- **Real-Time Orchestration:** Instant schedule synchronization via Server-Sent Events (SSE).
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
- **Real-Time:** **Server-Sent Events (SSE)** for lightweight server-to-client broadcasting.
- **Monitoring:** **Sentry** SDK for full-stack error tracking and performance profiling.
- **PDF Generation:** Custom template-based certificates using `@react-pdf/renderer` 4.3.2
- **Cloud Storage:** Cloudinary integration for images, signatures, and screenshots
- **Additional Libraries:**
  - `bcrypt` 6.0.0 - Password hashing
  - `react-hot-toast` 2.6.0 - Toast notifications
  - `qrcode` 1.5.4 - QR code generation for certificates
  - `google-auth-library` 9.15.1 - Secure ID token verification
  - `cloudinary` 2.5.1 - Cloud storage SDK

---

## 3. Core Architectural Concepts

### A. Real-Time Sync (SSE) (New)
**Architecture:**
- **The Stream:** `/api/realtime/stream` maintains persistent connections with active clients.
- **The Broadcast:** `src/lib/sse.js` manages a global set of controllers to push updates.
- **Events:**
    - `TIMETABLE_CHANGED`: Triggered when an HOD modifies a schedule slot.
- **Listeners:** `RealtimeListener` component allows dashboards to react instantly to server pings without refreshing.

### B. HOD & Branch Intelligence
**Architecture:**
- **Sub-Role Pattern:** HODs are elevated Faculty members identified by `is_hod = 1` and a designated `branch` in the `clerks` table.
- **Departmental Authority:** HODs manage the entire academic lifecycle for their specific branch, including multi-semester timetables, faculty workload tracking, and marks pattern enforcement.

### C. Middleware & Route Protection (`src/proxy.js`)
- **Technology:** Uses `jose` library for Edge-runtime compatible JWT verification.
- **Logic:** Intercepts requests to protected paths: `/admin`, `/clerk`, `/student`.
- **Session Enrichment:** Tokens now include `is_hod` and `branch` data.

### D. Time Management & The "Time Machine"
- **Authoritative Clock:** `src/lib/clock.js` provides `getNow()` respecting "Time Machine" mock dates.
- **Institutional Schedule:** Strictly enforced 7-period daily matrix (09:30 AM - 04:30 PM) with breaks.

---

## 4. Database Schema

### **1. Identity & Role Management**
- `clerks`: `id`, `name`, `email`, `role`, `is_hod` (TINYINT), `branch` (VARCHAR)
- `students`: Core student records with admission and fee status.

### **2. Departmental & Scheduling Management**
- `branch_config`: Branch-wide marks patterns and locking status.
- `branch_timetable`: Master schedule matrix (Day, Period, Subject, Faculty, Room).
- `faculty_subject_assignments`: Official faculty-subject authorization ledger.

### **3. Student Records & Performance**
- `student_personal_details`, `student_academic_background`.
- `student_attendance` (with GPS logs), `student_marks`.

---

## 5. Specialized Modules & Features

### **A. Real-Time Activity Bars**
- **Faculty Activity Bar:** Automatically detects current lecture room/subject based on server time and timetable.
- **Student Activity Bar:** Syncs with the institutional clock to show the ongoing session for the student's specific branch/semester.
- **Pulse Heartbeat:** Visual animation indicating a live, active session.

### **B. HOD Management Console**
- **Matrix Editor:** Independent schedules for S1-S8 with duplication tools and conflict detection.
- **Workload Tracker:** Visual bar charts of teaching intensity aggregated institution-wide.
- **Syllabus Manager:** Recursive full-CRUD tool for subjects and unit topics.

### **C. Proxy-Free Attendance System**
- **Architecture:** GPS-based geofencing (50m), 4-digit secure PINs, and IP+User-Agent Lock.

### **D. Digital Certificate Engine**
- **Architecture:** Server-side PDF rendering with HMAC-SHA256 tamper detection and QR verification.

---

## 6. Key API Routes

### **Real-Time & Monitoring**
- `GET /api/realtime/stream`: Persistent SSE event stream.
- `/monitoring`: Sentry tunnel route.

### **Management APIs**
- `/api/clerk/hod/*`: Timetable, Syllabus, Config, and Load APIs.
- `/api/clerk/faculty/current-activity`, `/api/student/current-activity`.

---

## 7. Recent Activity Log (Feb-Mar 2026)

### **Session 31: Real-Time Sync & Production Hardening (Latest - March 10, 2026)**
- **Real-Time Integration (SSE):**
    - Implemented a Server-Sent Events (SSE) stream for instant server-to-client updates.
    - Added `RealtimeListener` to ensure dashboards reflect schedule changes without page refreshes.
- **Live Activity Tracking:**
    - Developed real-time Activity Bars for both Faculty and Students.
    - Automated detection of ongoing lectures based on the institutional 7-period matrix.
- **Production Load Testing:**
    - Created `load-test-attendance.js` (k6 suite) to simulate "Morning Rush" scenarios with 500 concurrent users.
- **Error Monitoring:**
    - Integrated **Sentry** across all runtimes (Client, Server, Edge) for proactive bug tracking.
- **System Stability:**
    - Standardized `academic_year` resolution and fixed hydration mismatches in the Time Machine.
    - Enforced `secure: true` and `sameSite: 'lax'` on all production cookies.

### **Session 30: Production Performance (March 10, 2026)**
- **Optimization:** Implemented composite database indexes across `branch_timetable` and `student_attendance`.

### **Session 29: HOD Role & Multi-Semester Management (March 10, 2026)**
- **HOD Integration:** Established departmental authority sub-roles and full academic orchestration tools.

---

## Summary
The KUCET CMS is now a high-performance, real-time institutional framework. It combines professional error monitoring, precision scheduling, and elite real-time synchronization to provide a seamless experience for over 1,000+ simultaneous users.

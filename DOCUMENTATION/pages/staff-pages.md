# Institutional Staff Portal Workflows & Interface Specifications

## Overview

The Institutional Staff Portal (`/staff/*`) provides specialized workflows for academic admissions, scholarship administration, faculty lecture attendance, departmental timetable management, and staff account security.

Access is restricted to authenticated users holding `staff_auth` cookies with designated role assignments (`ADMISSION_CLERK`, `SCHOLARSHIP_CLERK`, `FACULTY`, or `is_hod: true`).

---

## 1. Role Segregation & Sub-Route Boundaries

```mermaid
graph TD
    A[Staff Auth Cookie / JWT] --> B{Resolve Staff Role}
    
    B -->|role: admission_clerk| C[/staff/admission/*]
    C --> C1[Student Enrollment & Registry]
    C --> C2[Student Profile Updates]
    C --> C3[Certificate Request Processing]
    C --> C4[Bulk Student Data Import]
    
    B -->|role: scholarship_clerk| D[/staff/scholarship/*]
    D --> D1[Fee Ledger Management]
    D --> D2[Scholarship Sanction Entry]
    D --> D3[Payment Verification]
    
    B -->|role: faculty| E[/staff/faculty/*]
    E --> E1[Multi-Modal Attendance]
    E --> E2[Mid-Exam Marks Entry]
    E --> E3[Syllabus & Materials]
    
    B -->|is_hod: true| F[/staff/hod/*]
    F --> F1[Semester Timetable S1-S8]
    F --> F2[Faculty Workload & Substitutions]
    F --> F3[Condonation Analytics]
    
    B -->|Any Authenticated Staff| G[/staff/settings/*]
    G --> G1[Profile Details & Image Upload]
    G --> G2[Security Center & Password Management]
```

---

## 2. Key Sub-Portals & Workflows

### 2.1 Admission Staff Portal (`/staff/admission/*`)
1. **Student Admission Drafts (`/staff/admission/student-management`, `/staff/admission/finalize`)**:
   - Continuous auto-saving to `student_admission_drafts` to prevent data loss.
   - Collects personal details, academic history (SSC, Inter, EAMCET), and uploads PFP/Signature.
   - Computes standardized roll numbers (`autoGenerateRollNumber.js`) per branch and entry category.
   - Finalization executes a transactional insert into `students`, `student_personal_details`, and `student_academic_background`.
2. **Student Request Processing (`/staff/admission/requests`)**:
   - Reviews Bonafide, Custodian, and Transfer certificate requests.
   - Approves requests triggering digital signature generation and verification QR stamping.
3. **Bulk Student Import (`/api/staff/admission/bulk-import`)**:
   - Asynchronous QStash worker processing with fallback to synchronous DB transactions.

---

### 2.2 Scholarship & Finance Staff Portal (`/staff/scholarship/*`)
1. **Fee Ledger & Payment Verification (`/staff/scholarship/dashboard`, `/staff/scholarship/student-records`)**:
   - Records manual fee payments (DD, Cash, Bank Transfer) with automated sequential receipt numbering.
   - Verifies online payment receipts submitted by students.
2. **Government Scholarship Sanction Entry**:
   - Manages state government scholarship releases (Jagananna Vidya Deevena / JVD).
   - Maps sanctioned amounts against student fee ledgers (`scholarship_sanctions`).

---

### 2.3 Faculty Portal (`/staff/faculty/*`)
1. **Multi-Modal Attendance Engine (`/staff/faculty/attendance`)**:
   - **Mode 1 (Manual)**: Toggle present/absent on complete class roster.
   - **Mode 2 (Dynamic PIN)**: 4-digit temporary PIN valid for 3 minutes.
   - **Mode 3 (GPS Geofence)**: 50m Haversine radius validation between faculty coordinates and student check-ins.
   - **Mode 4 (Dynamic QR)**: Cryptographic 15-second rotating QR token preventing proxy attendance via screenshots.
2. **Internal Marks Entry (`/staff/faculty/marks`)**:
   - Mid-term exam marks recording with out-of-range validation and lock/submission workflow.
3. **Syllabus & Lecture Topic Tracking (`/staff/faculty/syllabus`)**:
   - Records completed lecture topics linked to individual attendance sessions.

---

### 2.4 Head of Department (HOD) Console (`/staff/hod/*`)
1. **Semester Timetable Matrix (`/staff/hod/timetable`)**:
   - Configures 8 semesters (S1–S8) across 7 periods/day.
   - Automated conflict detection preventing faculty or room double-booking.
2. **Faculty Workload Balance & Substitutions (`/staff/hod/faculty-load`, `/staff/hod/substitutions`)**:
   - Tracks weekly lecture hours (flagging >16h overload or <8h underload).
   - Assigns substitute teachers for absent faculty, temporarily transferring attendance permissions.
3. **Condonation Analytics (`/staff/hod/attendance-analytics`)**:
   - Identifies students in condonation risk zone (65%–75%) or detention zone (<65%).

---

### 2.5 Staff Profile & Security Center (`/staff/settings/*`)
1. **Profile Editing (`/staff/settings/edit-profile`)**:
   - Client-side image compression (`compressImage()`) for avatars and signatures.
   - Relative storage key generation (`kucet/clerks/pfp/...` or `kucet/staff/...`).
2. **Security & Session Management (`/staff/settings/security`)**:
   - Password change, OTP-verified email updating, active device session audit, and remote session revocation.

---

## 3. Cross-References

- [Authentication Architecture](../authentication/authentication.md) — Multi-role cookies, `staff_auth`, JWT claims
- [Authorization & RBAC](../authentication/authorization.md) — Permission matrices for Admission, Scholarship, Faculty, HOD
- [Staff Management Feature Docs](../features/staff-management.md) — Onboarding wizard, admin approval pipeline
- [Backend Architecture](../architecture/backend.md) — Service layer, `wrapHandler` input validation
- [Frontend Architecture](../architecture/frontend.md) — RSC shells, `StaffContext`, Suspense boundaries

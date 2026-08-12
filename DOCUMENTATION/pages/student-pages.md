# Student Portal Workflows & Interface Specifications

## Overview

The Student Portal (`/student/*`) is a mobile-first web interface providing students with real-time access to academic timetables, attendance tracking, examination marks, fee ledgers, digital certificate requests, and account security controls.

---

## Route Structure & Accessibility Matrix

| Route Path | Feature Module | Required Auth State | Verification Required |
| :--- | :--- | :---: | :---: |
| `/student` | Student Dashboard | `student_auth` | ❌ (Accessible to setup account) |
| `/student/profile` | Personal Profile Details | `student_auth` | ❌ (Accessible) |
| `/student/settings/security` | Security Center & Credentials | `student_auth` | ❌ (Accessible) |
| `/student/attendance` | Subject-Wise Attendance Breakdown | `student_auth` | ✅ (Full Verification Required) |
| `/student/marks` | Academic Marks & Grades | `student_auth` | ✅ (Full Verification Required) |
| `/student/requests` | Certificate Application Portal | `student_auth` | ✅ (Full Verification Required) |
| `/student/finance` | Fee Ledger & Transaction History | `student_auth` | ✅ (Full Verification Required) |

---

## Key Workflows & UI Components

### 1. Main Student Dashboard (`/student`)
The dashboard aggregates core academic metrics:
- **Attendance Summary Card**: Displays overall attendance percentage with visual color coding (Green: $\ge 75\%$, Amber: $65\% - 74\%$, Red: $< 65\%$).
- **Today's Timetable & Action Center**: Shows current day periods, PIN verification, scholarship alerts, and live classroom activity.
- **Student Quick Links Grid (`StudentQuickLinks.js`)**: A responsive ERP service grid (4 columns desktop, 3 columns tablet, 2 columns mobile) providing direct keyboard-accessible navigation to verified portal modules:
  - *Apply Certificate* (`/student/requests/certificates`)
  - *Attendance & Marks* (`/student/academics`)
  - *Class Timetable* (`/student/timetable`)
  - *Fee Payment & Receipts* (`/student/finances`)
  - *Academic Profile* (`/student/profile`)
  - *Edit Profile* (`/student/settings/edit-profile`)
  - *Security Center* (`/student/settings/security`)
  - *ID Card Request* (`/student/requests/id-card`)

```mermaid
flowchart TD
    A[Student Login] --> B[Dashboard /student]
    B --> C[Attendance Gauge & Action Center]
    B --> D[Quick Links Grid 4x3x2 Responsive]
    B --> E[Fee Ledger & Receipts]
    D -->|Click| F[/student/requests/certificates]
    D -->|Click| G[/student/academics]
    D -->|Click| H[/student/finances]
    D -->|Click| I[/student/timetable]
```

---

### 2. Mobile Timetable Swipe Gesture System
The timetable component incorporates touch gesture handlers (`onTouchStart`, `onTouchMove`, `onTouchEnd`) allowing mobile users to swipe left/right to navigate between weekdays (Monday to Saturday).
- **Threshold Sensitivity**: 50px swipe offset triggers smooth day transition.
- **Visual Feedback**: Active day tab highlights with slide animations.

---

### 3. Subject-Wise Attendance Analytics (`/student/attendance`)
Provides transparent tracking of lecture attendance:
- **Per-Subject Cards**: Total conducted classes, attended classes, and percentage score.
- **Condonation Warning Engine**: Calculates the exact number of consecutive classes a student can afford to miss (or must attend) to stay above the mandatory $75\%$ threshold.
- **Attendance Appeal Workflow**: Allows students to submit formal absence appeals (with medical certificates or event proof) for faculty/HOD review.

---

### 4. Examination Marks & Performance Ledger (`/student/marks`)
- Displays Mid-1, Mid-2, Assignment, Lab Internal, and External end-semester marks.
- Highlights best-of-two Mid exam calculations according to university regulations.

---

### 5. Digital Certificate Request Portal (`/student/requests`)
Enables online applications for official institutional certificates:
- Supported Types: **Bonafide Certificate**, **Custodian Certificate**, **Transfer Certificate (TC)**.
- **Workflow**:
  1. Student selects certificate type and inputs purpose.
  2. Uploads supporting documentation (e.g. fee receipts or admission letters).
  3. Form submits to `student_requests` database table.
  4. Track application state: `PENDING` $\rightarrow$ `APPROVED` $\rightarrow$ `ISSUED`.
  5. Upon approval, renders downloadable PDF with embedded QR verification code.

---

### 6. Fee Ledger & Receipt Modal (`FeeTransactionHistory.js`)
Located in `/student/finance`, this component provides financial transparency:
- **Ledger Summary**: Total dues, amount paid, remaining balance, government scholarship reimbursement status (`JVD` / Non-JVD).
- **Transaction Table**: Lists receipt numbers, payment dates, payment modes (Online/Bank Chalan/Cash), and approval status.
- **Interactive Receipt Modal**: Clicking any transaction row opens a digital receipt modal formatted with institutional headers, stamp graphics, breakdown of fees (Tuition, Library, Exam, Special), and print/download options.

---

### 7. Security Center (`/student/settings/security`)
Empowers students to manage their account security:
- **Password Setup / Update**: BCrypt hashing with complexity validation.
- **Email Verification**: Sends OTP via Brevo API to verify student email address.
- **Active Device Sessions**: Displays active browser sessions, IP addresses, and operating systems.
- **Remote Revocation**: Allows students to terminate unrecognized active sessions.

---

## Cross-References

- [Authentication Architecture](../authentication/authentication.md)
- [Session Management & Revocation](../authentication/session-management.md)
- [Faculty Attendance Entry](./faculty-pages.md#attendance-entry-modes)
- [Clerk Certificate Verification](./clerk-pages.md#certificate-requests-review)

# Student Portal Workflows & Interface Specifications

## Overview

The Student Portal (`/student/*`) is a mobile-first web interface providing students with real-time access to academic timetables, attendance tracking, examination marks, fee ledgers, digital certificate requests, and account security controls.

---

## Route Structure & Accessibility Matrix

| Route Path | Feature Module | Required Auth State | Verification Required |
| :--- | :--- | :---: | :---: |
| `/student` | Student Dashboard (`StudentDashboardClient.js`) | `student_auth` | ❌ (Accessible to setup account) |
| `/student/profile` | Personal Profile Details | `student_auth` | ❌ (Accessible) |
| `/student/settings/security` | Security Center & Credentials | `student_auth` | ❌ (Accessible) |
| `/student/settings/edit-profile` | Student Profile & Mobile Number Editing | `student_auth` | ❌ (Accessible) |
| `/student/apaar` | APAAR ID Submission & Verification Portal | `student_auth` | ❌ (Accessible) |
| `/student/reactivate` | Student Account Reactivation Portal | `student_auth` | ❌ (Accessible for inactive accounts) |
| `/student/academics` | Unified Academics Hub (Subjects, Attendance, Internals, Achievements) | `student_auth` | ✅ (Full Verification Required) |
| `/student/academics/subjects/[assignmentId]` | Individual Subject Attendance & Timeline | `student_auth` | ✅ (Full Verification Required) |
| `/student/timetable` | Weekly Class Timetable | `student_auth` | ✅ (Full Verification Required) |
| `/student/finances` | Fee Ledger & Transaction History | `student_auth` | ✅ (Full Verification Required) |
| `/student/requests/certificates` | Digital Certificate Applications & Downloads | `student_auth` | ✅ (Full Verification Required) |
| `/student/requests/id-card` | Physical Student ID Card Replacement Request | `student_auth` | ✅ (Full Verification Required) |
| `/student/requests/profile-updates` | Student Profile Modification Requests | `student_auth` | ✅ (Full Verification Required) |

---

### Student Academics Hub (`/student/academics`)
Consolidates the student's complete academic lifecycle under a unified 4-tab interface ([`StudentAcademicsClient.js`](file:///run/media/admino/New%20Volume/User/Desktop/CMS/src/app/student/academics/StudentAcademicsClient.js)):
1. **Subjects**: Displays currently enrolled curriculum courses, course type (Theory, Lab, Seminar), assigned faculty names, syllabus curriculum links, and navigation to detailed subject timelines (`/student/academics/subjects/[assignmentId]`).
2. **Attendance**: Interactive visual bar chart and subject-by-subject percentage roster, displaying conducted vs. attended classes, and total aggregate attendance percentage.
3. **Internals**: Continuous Internal Evaluation (CIE) ledger:
   - *Theory Subjects*: Mid-1, Mid-2, Assignment marks, and computed Total Internal Score ($\max(\text{Mid 1}, \text{Mid 2}) + \text{Assignment}$, max 30).
   - *Practical / Lab Subjects*: Day-to-day Execution, Theory/Writing, and Record/Observation marks.
4. **Achievements**: Extracurricular, technical, and internship achievements registry with certificate image upload (capped at 1 MB via progressive client canvas compression).

---

## Key Workflows & UI Components

### 1. Main Student Dashboard (`/student`)
The main dashboard serves as the personalized portal overview:
- **Header Card**: Authoritative student name with Kakatiya Navy gradient, roll number, academic branch, year of study, and semester label.
- **Dashboard Action Center (`DashboardActionCenter.js`)**: Displays contextual priority notifications (pending fee payments, active attendance sessions, PIN verification alerts).
- **Student Quick Links Grid (`StudentQuickLinks.js`)**: A responsive ERP service grid (4 columns desktop, 3 columns tablet, 2 columns mobile) providing direct navigation to:
  - *Apply Certificate* (`/student/requests/certificates`)
  - *Attendance & Marks* (`/student/academics`)
  - *Class Timetable* (`/student/timetable`)
  - *Fee Payment & Receipts* (`/student/finances`)
  - *Academic Profile* (`/student/profile`)
  - *Edit Profile* (`/student/settings/edit-profile`)
  - *Security Center* (`/student/settings/security`)
  - *ID Card Request* (`/student/requests/id-card`)
- **Academic Records Panel**: Displays the student's enrolled subjects for the active academic session with dynamic visual icons, subject code, assigned faculty name, and live attendance percentage. Respects authoritative semester calendar and excludes previous semester subjects during semester breaks.
- **Internal Assessment Average (CIE) Panel**: Displays continuous internal evaluation average across evaluated subjects ($\max(\text{Mid 1}, \text{Mid 2}) + \text{Assignment}$ for theory, $\text{Execution} + \text{Writing} + \text{Record}$ for lab, max 30 marks) computed via [`calculateStudentCIE`](file:///run/media/admino/New%20Volume/User/Desktop/CMS/src/lib/evaluation-utils.js). Clearly denotes partial vs complete evaluations, handles pending marks, and features an explicit disclaimer that the score represents continuous internal assessment and not university CGPA/SGPA.

```mermaid
flowchart TD
    A[Student Login] --> B[Dashboard /student]
    B --> C[Academic Records & Attendance List]
    B --> D[Quick Links Grid 4x3x2 Responsive]
    B --> E[Action Center Alerts]
    D -->|Click| F[/student/requests/certificates]
    D -->|Click| G[/student/academics]
    D -->|Click| H[/student/finances]
    D -->|Click| I[/student/timetable]
```

---

### 2. Mobile Timetable Swipe Gesture System (`/student/timetable`)
The timetable component incorporates touch gesture handlers (`onTouchStart`, `onTouchMove`, `onTouchEnd`) allowing mobile users to swipe left/right to navigate between weekdays (Monday to Saturday).
- **Threshold Sensitivity**: 50px swipe offset triggers smooth day transition.
- **Visual Feedback**: Active day tab highlights with slide animations.

---

### 3. Subject Detail & Attendance Timeline (`/student/academics/subjects/[assignmentId]`)
Clicking on an individual subject card opens its dedicated timeline view:
- **Attendance Breakdown**: Total classes held, present sessions, NCC sessions, medical sessions, and absence count.
- **Chronological Session Timeline**: Date-by-date session log indicating period number, attendance status (`PRESENT`, `ABSENT`, `NCC`, `MEDICAL`), and session submission timestamp.
- **Dispute Submission Trigger**: Direct link to submit attendance dispute requests with documentary evidence.

---

### 4. APAAR ID Submission Portal (`/student/apaar`)
Dedicated government registry compliance portal:
- Captures and validates 12-digit APAAR numbers (`^\d{12}$`).
- Real-time keystroke validation with warning alerts preventing submission of Aadhaar numbers.
- One-time submission lock preventing client-side tampering post-commitment.


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
- [Staff Certificate Verification](./staff-pages.md#21-admission-staff-portal-staffadmission)

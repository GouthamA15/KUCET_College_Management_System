# KUCET CMS — Authoritative Institutional Business Rules: Certificate Architecture & Lifecycle

**Document Status:** Canonical Institutional Reference  
**Effective Date:** November 9, 2026  
**Audience:** Academic Administration, Software Architects, Full-Stack Engineers, Security Auditors  

---

## 1. Executive Mandate

This document serves as the authoritative, institutionally confirmed standard governing the **Certificate Lifecycle**, **Student Academic Classification**, **Bonafide Entitlement & Fee Collection**, **Two-Stage Endorsement Protocols**, and **Secure PDF Issuance** for the **Kakatiya University College of Engineering & Technology (KUCET)** College Management System.

All implementations must conform strictly to these rules. Inferred assumptions or conflicting ad-hoc logic must not override this standard.

---

## 2. Student Entry & Academic Classification Rules

### 2.1 Regular-Entry Students (4-Year Curricular Track)
- **Admission Point:** B.Tech Year I, Semester I.
- **University Roll Number Pattern:** Validated strictly via `src/lib/rollNumber.js`:
  $$\text{Regex: } \wedge(\backslash\text{d}\{2\})567\text{T}(\backslash\text{d}\{2\})([\text{A-Z}0-9]\{2\})\$$
  - Example: `26567T0901` (Admitted 2026, Branch 09 CSE, Roll 01).
  - Entrance Examination: **TG EAPCET** (derived via `getEntranceExamQualified(rollNo)`).
  - Course Duration: **4 Years** (8 Semesters).
- **University Roll Number Requirement:**
  - Students must possess an authoritative, valid university roll number before applying for a Bonafide or other certificates.
  - Temporary admission numbers (e.g., `ADM2026...`) or temporary identifiers are strictly blocked from certificate submission.

### 2.2 Lateral-Entry Students (3-Year Curricular Track)
- **Admission Point:** Direct lateral admission into B.Tech Year II, Semester III.
- **University Roll Number Pattern:** Validated strictly via `src/lib/rollNumber.js`:
  $$\text{Regex: } \wedge(\backslash\text{d}\{2\})567\text{T}?(\backslash\text{d}\{2\})([\text{A-Z}0-9]\{2\})\text{L}\$$
  - Example: `25567T0901L` or `255670901L` (Admitted 2025, Branch 09 CSE, Serial 01, Lateral 'L').
  - Entrance Examination: **TG ECET** (derived via `getEntranceExamQualified(rollNo)`).
  - Course Duration: **3 Years** (6 Semesters: Semesters III through VIII).
- **Crucial Institutional Distinction:**
  - Lateral students are **Curricular Year II** students upon admission.
  - However, they are in their **First Institutional Year at KUCET**.
  - `curricularYear === 1` must NEVER be used to represent first institutional year at KUCET.
  - For Bonafide format and fee entitlement purposes, Lateral students in their first institutional year at KUCET are entitled to the same first-year protections as Regular students.

### 2.3 Curricular Progression vs. Delayed Academic Calendar
- Institutional progression is tied to the **authoritative academic semester** (`study_semester`), not raw calendar year rollover.
- If a calendar year advances (e.g. from 2026 to 2027) while the university examination branch has not officially promoted the cohort to the next institutional year (e.g., cohort is completing Semester IV), the student remains in their first institutional year.
- A delayed academic calendar does not automatically convert students to senior percentage status.

### 2.4 Classification & Progression Matrix

| Student Track | Curricular Year | Semester | Institutional Year at KUCET | Applicable Bonafide Format | Fee Entitlement |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Regular** | I (First) | I | 1st Year | `ORDINARY` (No attendance clause) | ₹100 once (subsequent free) |
| **Regular** | I (First) | II | 1st Year | `ORDINARY` (No attendance clause) | ₹100 once (subsequent free) |
| **Lateral** | II (Second) | III | 1st Year | `ORDINARY` (No attendance clause) | ₹100 once (subsequent free) |
| **Lateral** | II (Second) | IV | 1st Year | `ORDINARY` (No attendance clause) | ₹100 once (subsequent free) |
| **Regular** | II (Second) | III | 2nd Year | `PERCENTAGE` (Attendance required) | Free (Senior Entitlement) |
| **Regular** | II (Second) | IV | 2nd Year | `PERCENTAGE` (Attendance required) | Free (Senior Entitlement) |
| **Lateral** | III (Third) | V | 2nd Year | `PERCENTAGE` (Attendance required) | Free (Senior Entitlement) |
| **Lateral** | III (Third) | VI | 2nd Year | `PERCENTAGE` (Attendance required) | Free (Senior Entitlement) |
| **Regular** | III (Third) | V / VI | 3rd Year | `PERCENTAGE` (Attendance required) | Free (Senior Entitlement) |
| **Lateral** | IV (Fourth) | VII / VIII | 3rd Year | `PERCENTAGE` (Attendance required) | Free (Senior Entitlement) |
| **Regular** | IV (Fourth) | VII / VIII | 4th Year | `PERCENTAGE` (Attendance required) | Free (Senior Entitlement) |

---

## 3. Bonafide Format & Certificate Rules

### 3.1 Ordinary Bonafide Certificate
- **Applicability:** Both Regular and Lateral students during their **first institutional year at KUCET**.
- **Attendance Percentage:** Must **NEVER** appear on Ordinary Bonafide. Even if attendance records exist in the portal, no attendance clause is rendered.
- **Document Text:** Certifies student name, father's name, university roll number, course, branch, curricular year (e.g., "II (SECOND) Year" for lateral, "I (FIRST) Year" for regular), semester, and academic year.
- **Label Invariant:** The label "Lateral Entry" must **NOT** be printed on the certificate. Admission type is strictly an internal workflow classification.

### 3.2 Percentage Bonafide Certificate
- **Applicability:** Students who have officially progressed into their **second or subsequent institutional year at KUCET**.
- **Attendance Percentage:** Mandatory attendance clause calculated dynamically by `AttendanceCalculationService.calculateCohortAttendance()`.
- **Zero-Session Guard:** If zero attendance sessions have been recorded in the portal for the student's cohort, automatic approval is blocked (`canApprove: false`, HTTP 422). The request must be referred to the branch HOD for departmental investigation. Attendance must never be fabricated.

---

## 4. Bonafide Lifetime Fee Entitlement Rules

- **First-Year Fee:** Both Regular and Lateral students pay **₹100 once** during their first institutional year at KUCET.
- **Pre-Application Payment:** For students requiring payment, payment via UPI (`kuengineeringcollege@sbi`) with valid UTR and screenshot upload must occur prior to submission.
- **Lifetime Entitlement:** Once an initial ₹100 payment is approved by Admission Staff, all subsequent Bonafide requests submitted by that student are **₹0 (Free)**.
- **Senior Entitlement:** Students in their 2nd, 3rd, or 4th institutional year at KUCET receive Bonafide certificates free of charge.
- **Payment Persistence:** A rejected request does not consume or destroy genuine payment proof. The student is permitted to re-apply using the same UTR and receipt without duplicate payment rejection.

---

## 5. Multi-Stage Approval Hierarchy & Delegation Rules

### 5.1 Institutional Authority Matrix

| Certificate Type | Stage 1 Endorsement | Stage 2 Final Verification & Issuance | Download Trigger |
| :--- | :--- | :--- | :--- |
| **Bonafide Certificate** | Respective Branch HOD | Admission Staff | Admission Staff Approval |
| **No Objection Certificate (NOC)** | Respective Branch HOD | Admission Staff | Admission Staff Approval |
| **Transfer Certificate (TC)** | Not Required | Admission Staff | Admission Staff Approval |
| **Course Completion Certificate** | Not Required | Admission Staff | Admission Staff Approval |
| **Migration Certificate** | Not Required | Admission Staff | Admission Staff Approval |
| **Study Conduct Certificate** | Not Required | Admission Staff | Admission Staff Approval |
| **Income Tax (IT) Certificate** | Not Required | Scholarship Staff | Scholarship Staff Approval |
| **Custodian Certificate** | Not Required | Scholarship Staff | Scholarship Staff Approval |

### 5.2 Branch HOD Isolation
- Only the active HOD for the student's enrolled department can endorse Stage 1.
- HODs with multi-branch assignments (`authorized_branches`) can review only students enrolled in their assigned departments.
- Administrators and Super Admins **cannot substitute** for the respective Branch HOD. Administrative roles have oversight visibility but cannot bypass Stage 1 HOD review.

### 5.3 Institutional Exception: No Active HOD Forwarding
- If a student's department has no active HOD assignment:
  1. The request is **NOT** left permanently stalled or unassigned.
  2. The HOD stage is **NOT** falsely marked as approved.
  3. The request is forwarded directly to **Admission Staff** for Stage 2 verification.
  4. The request records `hod_approval_status = 'NOT_REQUIRED'` and `flag_details: { hod_unavailable: true, reason: '...', forwarded_at: '...', forwarded_to: 'admission' }`.
  5. The staff queue displays an explicit badge: `HOD FORWARDED`.
  6. Admission Staff conducts full document, payment, and eligibility verification before release.

### 5.4 Two-Stage No Objection Certificate (NOC) Protocol
- An NOC requires **both** Stage 1 HOD endorsement and Stage 2 Admission Staff verification.
- Stage 1 HOD approval alone does **NOT** release the certificate for download.
- Admission Staff verification is mandatory before cryptographic certificate ID generation and PDF release.
- Scholarship Staff cannot approve or issue NOCs.

---

## 6. Secure Generation & Download Invariants

1. **Owner-Only Download:** Only the authenticated student owning the request can access `/api/student/requests/download/[request_id]`.
2. **Double-Gate Enforcement:** Download is strictly forbidden (HTTP 403) unless `status === 'APPROVED'` and `hod_approval_status !== 'PENDING'` and `hod_approval_status !== 'REJECTED'`.
3. **Cryptographic Certificate ID:** Generated using HMAC-SHA256 (`KUCET-XXXXXXXX`) with instant QR verification linking to `/verify?id=...&roll=...`.
4. **Single-Page A4 Guarantee:** All certificates must render to exact single-page A4 dimensions (595.28 pt $\times$ 841.89 pt) without content overflow.

# KUCET CMS — Certificate Workflow Remediation & Fix Report

**Report Date:** November 9, 2026  
**Auditor / Engineer:** Senior Full-Stack Architect & Security Reviewer  
**Target Branch:** `testvanilla`  
**Commit Scope:** Bug Detection, Two-Stage NOC Implementation, Lateral-Entry Progression, and Institutional Rule Enforcement  

---

## 1. Defect Summary & Root Cause Forensics

### Defect 1: Incomplete Two-Stage Workflow for No Objection Certificates (NOC)
- **Classification:** Severity: HIGH (Institutional Compliance & Process Integrity)
- **Root Cause:**
  - Previous implementations assumed NOC was approved solely by the Branch HOD.
  - In `src/app/api/staff/requests/route.js`, `roleToTypes.admission` did not include `'No Objection Certificate'`.
  - In `src/app/api/staff/requests/[request_id]/route.js`, an explicit guard rejected Admission Staff with HTTP 403 (`Forbidden. No Objection Certificates must be approved by the Department HOD`).
  - HOD approval immediately set `status = 'APPROVED'`, generated the certificate ID, and released the download, completely bypassing Admission Staff.
- **Affected Files:**
  - `src/app/api/staff/requests/route.js`
  - `src/app/api/staff/requests/[request_id]/route.js`
  - `src/app/api/student/requests/download/[request_id]/route.js`
  - `src/components/staff/certificates/CertificateActionPanel.js`
- **Remediation Implemented:**
  1. Added `'No Objection Certificate'` to `roleToTypes.admission`.
  2. Updated `PUT /api/staff/requests/[request_id]` to treat NOC identically to Bonafide:
     - Stage 1 HOD review: Sets `hod_approval_status = 'APPROVED'`, maintains `status = 'PENDING'`.
     - Stage 2 Admission review: Sets `status = 'APPROVED'`, generates HMAC-SHA256 certificate ID, records Admission Staff ID.
  3. Prohibited Admission Staff from reviewing NOC when `hod_approval_status === 'PENDING'`.
  4. Updated download endpoint to enforce `certRequest.status === 'APPROVED'` and `hod_approval_status !== 'PENDING'`.

---

### Defect 2: Missing HOD Assignment Exception (Institutional Forwarding Rule)
- **Classification:** Severity: MEDIUM (Operational Continuity)
- **Root Cause:**
  - If a student belonged to a department with no active HOD (or an expired assignment), `StudentCertificateService.determineCertificateRouting` left NOC requests stuck in `PENDING` with `hodStaffId: null`.
  - For Bonafide, it silently set `hodApprovalStatus: 'NOT_REQUIRED'` without recording the reason or notifying staff.
- **Affected Files:**
  - `src/services/identity/StudentCertificateService.js`
  - `src/app/api/student/requests/route.js`
  - `src/app/api/staff/requests/route.js`
  - `src/components/staff/certificates/CertificateRecordsView.js`
  - `src/components/staff/certificates/CertificateActionPanel.js`
- **Remediation Implemented:**
  1. Updated `determineCertificateRouting` for both Bonafide and NOC to detect when no active HOD exists.
  2. Forwarded the request directly to `staffType: 'admission'` with `hodApprovalStatus: 'NOT_REQUIRED'`, `hodUnavailable: true`, and documented institutional reason.
  3. Stored audit metadata in `flag_details: { hod_unavailable: true, reason: '...', forwarded_at: '...', forwarded_to: 'admission' }`.
  4. Added `HOD FORWARDED` badge in `CertificateRecordsView.js` and an explanatory institutional forwarding notice in `CertificateActionPanel.js`.
  5. Configured Admission Staff queue filters to display forwarded requests for immediate clearance.

---

### Defect 3: Entrance Exam Classification Bug for Lateral Roll Numbers with 'T'
- **Classification:** Severity: MEDIUM (Data Fidelity & Identity Validation)
- **Root Cause:**
  - In `src/lib/rollNumber.js`, `getEntranceExamQualified(rollNo)` used `if (rollNo.includes('T')) return 'TG EAPCET'`.
  - KUCET lateral roll numbers can include 'T' (e.g. `23567T0901L`, matching `lateralPattern = /^(\d{2})567T?(\d{2})([A-Z0-9]{2})L$/`).
  - Checking `includes('T')` before evaluating lateral identity caused lateral students to be erroneously categorized as `TG EAPCET` instead of `TG ECET`.
- **Affected Files:**
  - `src/lib/rollNumber.js`
- **Remediation Implemented:**
  1. Updated `getEntranceExamQualified` to leverage `validateRollNo(rollNo)`:
     ```javascript
     const { isValid, admissionType } = validateRollNo(rollNo);
     if (isValid) {
       return admissionType === 'Lateral' ? 'TG ECET' : 'TG EAPCET';
     }
     ```
  2. Maintained fallbacks for un-canonicalized rolls (`endsWith('L')` $\rightarrow$ `TG ECET`).

---

### Defect 4: Delayed Academic Calendar Lateral Progression Invariance
- **Classification:** Severity: HIGH (Eligibility & Fee Protection)
- **Root Cause:**
  - In `src/lib/academicClassification.js`, `yearsAtKucet` was calculated purely by subtracting calendar entry year from academic year start year (`currentStartYear - entryYearNum + 1`).
  - If the academic calendar was delayed (e.g., student remained in Semester IV during a calendar year rollover), the calculation would prematurely advance the student to their 2nd institutional year, incorrectly demanding Percentage Bonafide and revoking Ordinary Bonafide eligibility.
- **Affected Files:**
  - `src/lib/academicClassification.js`
- **Remediation Implemented:**
  1. Refactored `resolveAcademicClassification` so that when `studySemester` is provided, institutional progression is derived strictly from the active semester:
     - Lateral Semesters III & IV: Curricular Year 2, Institutional Year 1 (`isFirstYearAtKucet = true`, format: `ORDINARY`).
     - Lateral Semesters V & VI: Curricular Year 3, Institutional Year 2 (`isFirstYearAtKucet = false`, format: `PERCENTAGE`).
     - Lateral Semesters VII & VIII: Curricular Year 4, Institutional Year 3 (`isFirstYearAtKucet = false`, format: `PERCENTAGE`).
  2. Preserved the exact same semester-governed progression for Regular students.

---

### Defect 5: Staff Queues Omitted Mandatory Classification & Standing Columns
- **Classification:** Severity: MEDIUM (UI / Institutional Workflow Specification)
- **Root Cause:**
  - `GET /api/staff/requests` selected only basic request columns, omitting `admission_type`, `study_year`, `study_semester`, `years_at_kucet`, and `certificate_format`.
  - Staff were unable to distinguish Regular vs. Lateral students or view curricular year vs. institutional year in their queue.
- **Affected Files:**
  - `src/app/api/staff/requests/route.js`
  - `src/components/staff/certificates/CertificateRecordsView.js`
  - `src/components/staff/certificates/CertificateActionPanel.js`
- **Remediation Implemented:**
  1. Added `admission_type`, `study_year`, `study_semester`, `years_at_kucet`, `certificate_format`, and `generated_attendance` to the SQL query.
  2. Dynamically mapped fallback values for legacy rows using `validateRollNo(roll_number)`.
  3. Added Category & Branch badges, Curricular Standing (`Yr X / Sem Y`), and Institutional Year indicators (`(Inst. Yr Z)`) to `CertificateRecordsView.js`.
  4. Expanded `CertificateActionPanel.js` with structured admission category and curricular standing sections.

---

### Defect 6: Super Admin Bypass in Stage 1 HOD Review
- **Classification:** Severity: MEDIUM (RBAC & Separation of Duties)
- **Root Cause:**
  - In `src/app/api/staff/requests/[request_id]/route.js`, line 80 permitted `staff.role === 'admin'` to bypass branch verification and act as an HOD.
- **Affected Files:**
  - `src/app/api/staff/requests/[request_id]/route.js`
- **Remediation Implemented:**
  - Removed admin bypass for Stage 1 HOD review. Stage 1 endorsement strictly requires `effectiveRole === 'hod'` and the student's branch to be present in `authorized_branches`.

---

## 2. Verification & Regression Test Evidence

| Test Suite File | Tests | Status | Key Assertions Verified |
| :--- | :---: | :---: | :--- |
| `tests/unit/api/staff/certificate-requests-regression.test.js` | 18 | PASS | Two-stage NOC approval, HOD branch scoping, lateral roll matching, TG ECET derivation, semester-based progression, missing-HOD forwarding, admin bypass prevention. |
| `tests/unit/pdf/certificate-pdf-generation-all-types.test.js` | 15 | PASS | Real PDF binary rendering, single-page A4 dimensions (595.28 $\times$ 841.89 pt), text extraction via Poppler `pdftotext`, Ordinary vs. Percentage format enforcement. |
| `tests/unit/bonafide/bonafide-concurrency.test.js` | 18 | PASS | Duplicate UTR rejection, full-length SHA-256 hash advisory locks, connection pool safety, re-submission after rejection. |
| `tests/unit/bonafide/bonafide-enhancement.test.js` | 34 | PASS | Lifetime fee entitlement, pending lock enforcement, semester snapshot backfills. |
| `tests/unit/bonafide/bonafide-api-and-pdf.test.js` | 5 | PASS | End-to-end API simulation and template layout. |
| **Complete System Test Suite** | **2,060+** | **PASS** | **196 of 196 test files passing cleanly with zero failures.** |

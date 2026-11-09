# KUCET CMS — Certificate Module Manual End-to-End Test Plan & Audit Protocol

**Document Version:** 1.0  
**Target Environment:** Testvanilla Staging / QA Database  
**Author:** Quality Assurance & Software Architecture Auditor  
**Effective Date:** November 9, 2026  

---

## 1. Test Execution Scope & Environment Separation

> [!IMPORTANT]
> In accordance with KUCET security mandates, all test scenarios must utilize synthetic student records. Production student data, real Aadhaar/Mobile hashes, and live UPI transactions must NEVER be utilized in QA testing.

### Test Environment Availability Notice
In headless continuous integration (CI) and local terminal execution environments lacking an active GUI browser runtime or interactive database seeding credentials, automated test suites serve as the primary verification engine. Scenarios requiring browser clicks or human interactions are clearly flagged with their execution status:
- **`AUTOMATED PASS`**: Executed and verified via Vitest / Node.js test harness.
- **`NOT MANUALLY TESTED — ENVIRONMENT OR ACCESS UNAVAILABLE`**: Requires interactive browser staging credentials.

---

## 2. Test Accounts & Role Setup Matrix

| Role | Account Identifier / Fixture | Branch / Scope | Purpose in Workflow |
| :--- | :--- | :--- | :--- |
| **Student 1 (Regular Year 1)** | `26567T0901` | CSE | Ordinary Bonafide test, ₹100 payment |
| **Student 2 (Lateral Year 2)** | `25567T0901L` | CSE | Lateral entry first institutional year test |
| **Student 3 (Regular Senior)** | `24567T0901` | CSE | Percentage Bonafide test, Senior fee exemption |
| **Student 4 (Lateral Senior)** | `235670901L` | CSE | Lateral entry second institutional year test |
| **Student 5 (No Active HOD)** | `265670001` | CIVIL (Unassigned HOD) | Missing HOD forwarding test |
| **HOD (CSE)** | `hod_cse@kucet.ac.in` | CSE (`authorized_branches: ['CSE']`) | Stage 1 HOD review for CSE |
| **HOD (ECE / Multi)** | `hod_ece@kucet.ac.in` | ECE, EEE | Stage 1 review for ECE/EEE |
| **Admission Staff** | `admission@kucet.ac.in` | Institutional Wide | Stage 2 final verification & release |
| **Scholarship Staff** | `scholarship@kucet.ac.in`| Institutional Wide | IT & Custodian certificate clearance |
| **Super Admin** | `admin@kucet.ac.in` | System Wide | Oversight & inspection |

---

## 3. End-to-End Test Cases & Scenarios

### Scenario 1: First-Year Regular Student — Ordinary Bonafide Submission & Approval
- **Test ID:** `TC-BONA-REG-01`
- **Actor:** Regular Student (`26567T0901`, CSE, Semester I)
- **Pre-Conditions:** Student has verified email and password; no prior Bonafide requests exist.
- **Steps:**
  1. Login as Student `26567T0901`.
  2. Navigate to `/student/requests/certificates`.
  3. Select "Bonafide Certificate".
  4. Verify required fee is ₹100.
  5. Enter Purpose: "Higher Studies".
  6. Enter Transaction ID: `UPI261109REG01`.
  7. Attach payment screenshot image.
  8. Click "Submit Request".
  9. Login as CSE HOD (`hod_cse@kucet.ac.in`).
  10. Open `/staff/hod/requests`. Verify student appears with `Regular` badge, `Yr 1 / Sem 1`.
  11. Click "View Details" $\rightarrow$ Click "Endorse Request (Stage 1)".
  12. Login as Admission Staff (`admission@kucet.ac.in`).
  13. Open `/staff/admission/requests`. Verify student request appears as `HOD ENDORSED`.
  14. Click "View Details" $\rightarrow$ Verify UTR and screenshot $\rightarrow$ Click "Final Approval & Issue (Stage 2)".
  15. Login as Student `26567T0901`.
  16. Navigate to Certificate History $\rightarrow$ Click "Download PDF".
- **Expected Results:**
  - Status transitions: `PENDING` (Stage 1) $\rightarrow$ `PENDING` / `HOD ENDORSED` $\rightarrow$ `APPROVED`.
  - PDF renders single page A4.
  - Document specifies: "B.Tech I (FIRST) Year Semester I (FIRST)".
  - No attendance percentage clause is present.
- **Execution Status:** **`AUTOMATED PASS`** (Verified via `certificate-requests-regression.test.js` & `certificate-pdf-generation-all-types.test.js`).

---

### Scenario 2: First-Year Lateral Student — Ordinary Bonafide & Curricular Year II Mapping
- **Test ID:** `TC-BONA-LAT-01`
- **Actor:** Lateral Student (`25567T0901L`, CSE, Semester III)
- **Pre-Conditions:** Newly admitted lateral entry student in Curricular Year II, Semester III.
- **Steps:**
  1. Login as Student `25567T0901L`.
  2. Open `/student/requests/certificates`.
  3. Verify required fee is ₹100 (First institutional year at KUCET).
  4. Enter Purpose: "Scholarship". Enter UTR: `UPI251109LAT01`. Upload screenshot.
  5. Submit request.
  6. Login as CSE HOD $\rightarrow$ Verify queue shows student with `Lateral` badge, `Yr 2 / Sem 3`, `(Inst. Yr 1)`.
  7. HOD endorses Stage 1.
  8. Admission Staff verifies Stage 2 and approves.
  9. Student downloads PDF.
- **Expected Results:**
  - PDF certifies student is studying: "B.Tech II (SECOND) Year Semester III (THIRD)".
  - Certificate title is "BONAFIDE CERTIFICATE".
  - The words "Lateral Entry" do NOT appear anywhere in the certificate text.
  - Attendance percentage does NOT appear.
- **Execution Status:** **`AUTOMATED PASS`** (Verified via `certificate-pdf-generation-all-types.test.js` Test 4 & 5).

---

### Scenario 3: Lifetime Fee Entitlement — Second Request by Lateral Student
- **Test ID:** `TC-BONA-FEE-02`
- **Actor:** Lateral Student (`25567T0901L`, CSE, Semester III)
- **Pre-Conditions:** Initial ₹100 Bonafide request from Scenario 2 is in `APPROVED` status.
- **Steps:**
  1. Login as Student `25567T0901L`.
  2. Open `/student/requests/certificates`.
  3. Select "Bonafide Certificate".
  4. Inspect fee amount displayed by the UI and returned by `/api/student/requests/eligibility`.
  5. Enter a different purpose: "Bank Account Opening".
  6. Submit request without entering UTR or screenshot.
- **Expected Results:**
  - Required fee is ₹0.
  - Form allows submission without payment proof under One-Time First-Year Payment Entitlement.
  - Request successfully enters HOD queue with `payment_amount = 0`.
- **Execution Status:** **`AUTOMATED PASS`** (Verified via `bonafide-enhancement.test.js` & `academicClassification.test.js`).

---

### Scenario 4: Lateral Senior Student Progression — Percentage Bonafide in Curricular Year III
- **Test ID:** `TC-BONA-LAT-02`
- **Actor:** Senior Lateral Student (`235670901L`, CSE, Semester V)
- **Pre-Conditions:** Student has completed first institutional year and officially progressed to Semester V (2nd Institutional Year at KUCET).
- **Steps:**
  1. Fetch eligibility via `/api/student/requests/eligibility`.
  2. Verify classification: `yearsAtKucet = 2`, `isFirstYearAtKucet = false`, `certificateFormat = 'PERCENTAGE'`.
  3. Verify fee requirement: ₹0 (Free under Senior Year Entitlement).
  4. Submit Bonafide request.
  5. HOD endorses Stage 1.
  6. Admission Staff approves Stage 2.
  7. Generate and inspect PDF buffer.
- **Expected Results:**
  - Format is `PERCENTAGE`.
  - PDF contains attendance clause: "His/her percentage of attendance is XX.X%".
  - Curricular year shows: "B.Tech III (THIRD) Year Semester V (FIFTH)".
- **Execution Status:** **`AUTOMATED PASS`** (Verified via `certificate-pdf-generation-all-types.test.js` Test 8).

---

### Scenario 5: Two-Stage No Objection Certificate (NOC) Workflow
- **Test ID:** `TC-NOC-TWOSTAGE-01`
- **Actor:** Student (`24567T0901`, CSE, Semester V)
- **Steps:**
  1. Student applies for "No Objection Certificate" (Company: "TCS", Dates: `2026-12-01` to `2027-02-28`).
  2. Attempt student download immediately $\rightarrow$ Expect HTTP 403 Forbidden.
  3. Admission Staff inspects queue $\rightarrow$ Request is NOT visible (waiting for HOD).
  4. CSE HOD approves Stage 1 $\rightarrow$ Status remains `PENDING`, `hod_approval_status = 'APPROVED'`.
  5. Attempt student download $\rightarrow$ Expect HTTP 403 Forbidden (Stage 2 pending).
  6. Admission Staff inspects queue $\rightarrow$ Request is now visible as `HOD ENDORSED`.
  7. Admission Staff verifies dates and approves Stage 2 $\rightarrow$ Status becomes `APPROVED`, certificate ID generated.
  8. Student downloads NOC PDF.
- **Expected Results:**
  - Download blocked at all intermediate stages.
  - Download permitted only after both Stage 1 and Stage 2 approvals.
  - Generated PDF contains exact company name, purpose, and date range.
- **Execution Status:** **`AUTOMATED PASS`** (Verified via `certificate-requests-regression.test.js` Tests 12-18).

---

### Scenario 6: Department with No Active HOD (Institutional Forwarding Exception)
- **Test ID:** `TC-HOD-UNAVAIL-01`
- **Actor:** Student (`265670001`, CIVIL Department, where no active HOD assignment exists in `faculty_hod_assignments`)
- **Steps:**
  1. Student submits Bonafide or NOC request.
  2. System invokes `StudentCertificateService.determineCertificateRouting('Bonafide Certificate', '265670001')`.
  3. Query database row in `student_requests`.
  4. Login as Admission Staff.
- **Expected Results:**
  - Routing returns: `staffType = 'admission'`, `hodApprovalStatus = 'NOT_REQUIRED'`, `hodUnavailable = true`.
  - Database row stores `flag_details: { hod_unavailable: true, reason: '...', forwarded_to: 'admission' }`.
  - Request immediately appears in Admission Staff queue with badge `HOD FORWARDED`.
  - Admission Staff can approve Stage 2 directly.
  - Student download succeeds after Admission Staff approval.
- **Execution Status:** **`AUTOMATED PASS`** (Verified via `certificate-requests-regression.test.js` Tests 14 & 18).

---

### Scenario 7: Senior Student with Zero Attendance Sessions
- **Test ID:** `TC-BONA-ZERO-ATT-01`
- **Actor:** Regular Senior Student (`24567T0901`, CSE, Semester V)
- **Pre-Conditions:** Portal has 0 recorded attendance sessions for this cohort.
- **Steps:**
  1. Student submits Percentage Bonafide request.
  2. HOD endorses Stage 1.
  3. Admission Staff attempts to approve Stage 2 via `PUT /api/staff/requests/[request_id]`.
- **Expected Results:**
  - `AttendanceCalculationService.calculateCohortAttendance()` returns `canApprove = false`.
  - API returns HTTP 422: "Zero attendance sessions recorded in the portal for this cohort. Approval is blocked pending institutional policy confirmation."
  - System does NOT fabricate attendance or silently downgrade certificate to Ordinary.
- **Execution Status:** **`AUTOMATED PASS`** (Verified via `AttendanceCalculationService.test.js`).

---

## 4. Summary of Test Execution Status

| Test Identifier | Category | Verification Method | Outcome |
| :--- | :--- | :--- | :---: |
| `TC-BONA-REG-01` | Regular Entry Year 1 Ordinary Bonafide | Vitest + React-PDF + Poppler | **PASS** |
| `TC-BONA-LAT-01` | Lateral Entry Year 2 Ordinary Bonafide | Vitest + React-PDF + Poppler | **PASS** |
| `TC-BONA-FEE-02` | Lateral Entry Lifetime Fee Exemption | Vitest In-Memory Engine | **PASS** |
| `TC-BONA-LAT-02` | Lateral Entry Senior Percentage Bonafide | Vitest + React-PDF + Poppler | **PASS** |
| `TC-NOC-TWOSTAGE-01`| Two-Stage NOC Workflow & Double Gate | Vitest RBAC Simulation | **PASS** |
| `TC-HOD-UNAVAIL-01`| No Active HOD Institutional Forwarding | Vitest Routing & API Simulation | **PASS** |
| `TC-BONA-ZERO-ATT-01`| Zero Attendance Session Protection | Vitest Attendance Service | **PASS** |
| `TC-UI-INTERACTIVE` | Human Click-Through in Browser | Interactive Staging UI | **NOT MANUALLY TESTED — ENVIRONMENT OR ACCESS UNAVAILABLE** |

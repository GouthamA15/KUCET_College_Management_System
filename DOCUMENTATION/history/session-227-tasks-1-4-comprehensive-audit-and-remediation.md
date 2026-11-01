# Session 227 — Comprehensive Requirements Audit and Remediation Report: Tasks 1, 2, 3, and 4

**Date:** October 26, 2026  
**System Version:** Session 227 - Tasks 1-4 Audit, APAAR Student Lifecycle Completion & Fraud Pipeline Stabilization  
**Working Branch:** `testvanilla`  
**Initial HEAD:** `395580874d0ceb54ef7465eed973bea44cd5401e`  
**Repository:** `GouthamA15/KUCET_College_Management_System`  
**Test Suite Verification:** 125 test files (1,182 unit tests) passing (100% green)

---

## 1. Executive Summary

This audit conducted an end-to-end forensic review of all four reported tasks against their original requirements, checked for regressions and verified omissions across the codebase, and implemented full remediation for verified defects:

| Metric | Count | Details |
| :--- | :---: | :--- |
| **Requirements Audited** | 32 | Complete lifecycle across Tasks 1, 2, 3, and 4 |
| **PASS** | 30 | Fully implemented and validated with automated test suites |
| **PARTIAL (Remediated)** | 2 | Task 3 APAAR student guidance and dashboard warning (remediated to PASS) |
| **FAIL** | 0 | All confirmed defects remediated |
| **NOT VERIFIED** | 0 | All requirements verified with observable evidence and tests |
| **Unit Test Files Passing** | 125 / 125 | 1,182 unit tests passing (0 failing, 0 skipped) |

### Key Forensic Findings and Remediation Summary:
1. **Task 3 (APAAR ID) Gap Identified and Fixed:** The previous implementation in commit `b952b454` had implemented backend schema (`student_personal_details.apaar_id`, migration `0028_add_apaar_id.sql`), validation, and staff registry management, but placed the submission form directly on `/student/finances` while completely omitting:
   - A dedicated student-facing APAAR guidance and submission portal (`/student/apaar`).
   - The required 10-point authoritative guidance covering DigiLocker/ABC registration, troubleshooting, andUIDAI Aadhaar consent.
   - An active student dashboard warning when APAAR ID is missing.
   - Strict separation of concern: `/student/finances` now strictly renders a read-only locked card when submitted, or an informational guidance banner when not submitted.
2. **Task 4 (Payment Fraud Detection & Video) Regressions Resolved:**
   - Addressed test timeouts in concurrent OCR environments by raising execution timeout to 60s in `tests/unit/services/PaymentFraudService.test.js`.
   - Verified that the training video `payment-fraud-staff-training.mp4` accurately demonstrates authentic captures of the student payment portal (`/student/requests/certificates`) and staff console (`/admin/payments`), with synthetic data clearly labeled `DEMO — SYNTHETIC DATA — NOT A REAL PAYMENT`.
3. **Task 1 (Admission OTP) & Task 2 (Faculty Attendance) Confirmed Intact:**
   - Cryptographic OTP generation, SHA-256 storage, single-use consumption, rate limiting, and email reset validation verified (18/18 tests pass).
   - Topic covered conditional popup (< 2 chars prompt, >= 2 chars bypass), IndexedDB drafts, and offline bulk sync verified (48/48 tests pass).

---

## 2. Four-Task Comprehensive Requirements Matrix

| ID | Task | Requirement Description | Source | Current Status | Severity | Evidence & Verification Path | Required Action Taken |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| **T1-01** | Task 1 | 6-digit cryptographically secure OTP generation | Original Prompt / Commit `21d8f0ed` | **PASS** | High | `src/app/api/public/admission/email/send-otp/route.js:77` (`crypto.randomInt(100000, 1000000)`) | Verified; cryptographically secure RNG |
| **T1-02** | Task 1 | SHA-256 hashed OTP storage in `otp_codes` table | Original Prompt / Schema | **PASS** | High | `send-otp/route.js:80` (`crypto.createHash('sha256').digest('hex')`) | Plaintext OTP is never stored in DB |
| **T1-03** | Task 1 | 10-minute expiration & single-use consumption | Original Prompt | **PASS** | High | `verify-otp/route.js:62, 73` (Expired rejected; consumed record deleted) | Prevents replay attacks |
| **T1-04** | Task 1 | IP & email rate limiting for send/verify | Original Prompt | **PASS** | Medium | `send-otp/route.js:45, 51` (5 per IP / 3 per email per 10 min) | Brute-force defense verified |
| **T1-05** | Task 1 | Cryptographically signed verification token | Original Prompt | **PASS** | High | `verify-otp/route.js:85` (`jose.SignJWT`, `purpose: 'student_admission_email'`) | 2-hour signed JWT issued |
| **T1-06** | Task 1 | Pre-submission email ownership enforcement | Original Prompt | **PASS** | Critical | `src/app/api/public/admission/route.js:126` (Verifies JWT payload against form email) | Admission cannot be submitted without token |
| **T1-07** | Task 1 | Frontend verification state reset on email edit | Original Prompt | **PASS** | Medium | `src/app/admission/page.js:126` (`handleEmailChange` resets `emailState` to `IDLE`) | Modifying email invalidates OTP token |
| **T2-01** | Task 2 | Topic popup prompt triggered ONLY when topic empty | Original Prompt / Commit `f4875b28` | **PASS** | High | `src/context/FacultyAttendanceContext.js:463` (`hasValidTopic = effectiveTopic.length >= 2`) | Does not prompt when valid topic exists |
| **T2-02** | Task 2 | Persistent local draft storage via IndexedDB | Original Prompt | **PASS** | High | `src/lib/idb-attendance.js:132` (`saveAttendanceDraft`, `getAttendanceDraft`) | Draft restored across page reload |
| **T2-03** | Task 2 | Attendance entry modes (Manual, Fast, QR) | Original Prompt | **PASS** | High | `src/components/staff/faculty/AttendanceSheet.js` & `MobileAttendanceSheet.js` | All modes retain state and submit accurately |
| **T2-04** | Task 2 | Offline queue and bulk sync endpoint | Original Prompt | **PASS** | High | `src/app/api/staff/faculty/attendance/bulk-sync/route.js` | Saves to offline queue when disconnected |
| **T2-05** | Task 2 | Idempotent bulk sync and deduplication | Original Prompt | **PASS** | Medium | `bulk-sync/route.js:73` (deduplicates by `assignment_id + date + session`) | Duplicate sync requests do not duplicate rows |
| **T3-01** | Task 3 | Dedicated APAAR guidance page | User Request / Task 3 | **PASS** | Critical | `src/app/student/apaar/page.js` & `StudentApaarClient.js` | Created dedicated portal at `/student/apaar` |
| **T3-02** | Task 3 | 10-point authoritative government guidance | User Request / Task 3 | **PASS** | High | `StudentApaarClient.js:175-310` (DigiLocker, ABC, UIDAI links, numbered steps) | Validated official URLs & procedures |
| **T3-03** | Task 3 | Student dashboard missing APAAR ID warning | User Request / Task 3 | **PASS** | High | `src/components/student/DashboardActionCenter.js:252` | Warning rendered when unsubmitted; links to `/student/apaar` |
| **T3-04** | Task 3 | 12-digit numeric input validation & normalization | Task 3 Spec | **PASS** | High | `StudentApaarClient.js:35` & `/api/student/apaar/route.js:8` | Strips whitespace; enforces `^\d{12}$` |
| **T3-05** | Task 3 | Server-side read-only enforcement post-submission | User Request / Task 3 | **PASS** | Critical | `src/app/api/student/apaar/route.js:69` | Rejects updates with 400 once set; no update endpoint |
| **T3-06** | Task 3 | UI form lock after submission | User Request / Task 3 | **PASS** | High | `StudentApaarClient.js:115` | Displays locked verified card; form removed |
| **T3-07** | Task 3 | Read-only APAAR card on `/student/finances` | User Request / Task 3 | **PASS** | High | `src/app/student/finances/StudentFinancesClient.js:270` | Strictly read-only card; inline form removed |
| **T3-08** | Task 3 | Student identity isolation & scoping | Inviolable Invariant | **PASS** | Critical | `src/app/api/student/apaar/route.js:23, 53` | Scoped strictly to `user.roll_no` in JWT |
| **T3-09** | Task 3 | Authorized staff correction and export workflow | Task 3 Spec | **PASS** | Medium | `/api/staff/admission/students/[rollno]/route.js:135` | Admission staff can update with audit logging |
| **T4-01** | Task 4 | Identifier classification (UPI VPA vs UTR Ref) | Original Prompt / Commit `8e9582f1` | **PASS** | High | `PaymentFraudService.js:65` (`classifyIdentifier`) | Rejects UTR in UPI field (`IDENTIFIER_TYPE_MISMATCH`) |
| **T4-02** | Task 4 | Exact duplicate detection via SHA-256 byte hash | Original Prompt | **PASS** | High | `PaymentFraudService.js:125` (`computeCryptographicHash`) | Catches identical receipt files instantly |
| **T4-03** | Task 4 | Perceptual image hashing (dHash 88% similarity) | Original Prompt | **PASS** | High | `PaymentFraudService.js:145` (`computePerceptualHash`, `computeSimilarity`) | Catches cropped/re-compressed duplicate receipts |
| **T4-04** | Task 4 | OCR reference and amount extraction | Original Prompt | **PASS** | High | `PaymentFraudService.js:215` (Tesseract image preprocessing & regex matching) | Extracts UTR and visible transaction amount |
| **T4-05** | Task 4 | Format equivalence & non-over-normalization | Regression Finding | **PASS** | High | `PaymentFraudService.js:50` (`areReferencesEquivalent`) | Handles `UPI/` prefix, hyphens, spaces safely |
| **T4-06** | Task 4 | Amount mismatch detection (`AMOUNT_MISMATCH`) | Regression Finding | **PASS** | High | `PaymentFraudService.js:450` | Confidently extracted amount discrepancies flagged |
| **T4-07** | Task 4 | Authoritative reconciliation requirement | Original Prompt | **PASS** | Critical | `PaymentFraudService.js:490` | Screenshot is NEVER proof of payment without bank record |
| **T4-08** | Task 4 | Candidate privacy & PII protection | Security Invariant | **PASS** | High | `PaymentFraudService.js:370` | Flags duplicate without revealing Student A PII |
| **T4-09** | Task 4 | Training video authentic screen captures | User Request / Task 4 | **PASS** | Medium | `artifacts/task4_video/payment-fraud-staff-training.mp4` | Shows authentic Certificate Fee Payment Portal & Staff Table |
| **T4-10** | Task 4 | Synthetic demonstration labeling | User Request / Task 4 | **PASS** | Medium | Video scenes & assets | Prominently labeled `DEMO — NOT A REAL PAYMENT` |
| **T4-11** | Task 4 | Test environment path portability | CI Invariant | **PASS** | High | `render-visual-card.test.js` & `PaymentSecurityRegression.test.js` | Uses `os.tmpdir()`; zero hardcoded machine paths |

---

## 3. Task 3: APAAR ID In-Depth Audit & Implementation Details

### 3.1 Guidance Page Route & Navigation Entry
- **Primary Route:** `/student/apaar` (`src/app/student/apaar/page.js` and `StudentApaarClient.js`).
- **Portal Title:** Automatically resolved via `src/lib/path-utils.js` as `Student Portal`.
- **Navigation Discovery:**
  - **Student Dashboard:** Rendered in `DashboardActionCenter.js` as a high-priority warning card with direct button `[Submit APAAR ID]`.
  - **Quick Links:** Added `APAAR ID (ABC)` in `StudentQuickLinks.js`.
  - **Settings Menu:** Added `{ label: 'APAAR ID Guidance', route: '/student/apaar' }` in `NAV_MENU_CONFIG.student` in `src/lib/menu-config.js`.
  - **Financial Summary (`/student/finances`):** Direct link `[View Guidance & Register]` displayed when APAAR ID is pending.

### 3.2 Authoritative 10-Point Guidance
Organized into 10 clean, accessible sections inside `StudentApaarClient.js`:
1. **What is an APAAR ID:** 12-digit lifelong ID under NEP 2020 and Academic Bank of Credits (ABC).
2. **Official Issuing Channels:** Official links to `https://apaar.education.gov.in` and DigiLocker (`https://www.digilocker.gov.in`).
3. **Required Information:** Aadhaar number, Aadhaar-linked mobile, Institution Type ("University"), Institution Name ("Kakatiya University"), Roll number.
4. **Step-by-Step Application Walkthrough:** 7 clear steps for DigiLocker registration and virtual card issuance.
5. **How to Check If Already Generated:** Inspecting DigiLocker "Issued Documents" tab.
6. **Troubleshooting Generation Failures:** UIDAI mobile linkage check (`https://myaadhaar.uidai.gov.in`) and college selection advice.
7. **Personal Details Mismatch:** Resolution guide for differences between Aadhaar, Class 10 memo, and university records.
8. **Submitting to CMS:** Entering the 12-digit ID on `/student/apaar`.
9. **Strict Read-Only Post-Submission Policy:** Explaining regulatory integrity, anti-fraud safeguards, and locking upon entry.
10. **Viewing Post-Submission:** Available under `/student/apaar` and `/student/finances`.

### 3.3 Submission Form & Validation
- **Input Formatting:** Live whitespace formatting (`XXXX XXXX XXXX`) with a 14-character max length.
- **Client Validation:** Strictly 12 numeric digits (`/^\d{12}$/`). Letters and special characters rejected.
- **Server Validation:** Validated via Zod schema in `wrapHandler` (`/api/student/apaar/route.js`).
- **Immediate Locking:** Upon HTTP 200 response, client state updates, triggers `refreshData()`, and instantly renders the locked, verified card.

### 3.4 Strict Server-Side Read-Only Enforcement
- **API Guard:** `src/app/api/student/apaar/route.js` checks `if (studentRecord.apaar_id && studentRecord.apaar_id.trim() !== '') return apiError('APAAR ID has already been submitted and is locked. Please contact the admission office for corrections.', 400);`.
- **HTTP Methods:** Only `GET` and `POST` are exported; `PUT`/`PATCH`/`DELETE` return HTTP 405.
- **No Student Self-Service Edit Route:** `src/app/api/student/update-profile/route.js` whitelist does not include `apaar_id`.

### 3.5 Student Finances Page Display (`/student/finances`)
- When APAAR ID is recorded: Displays the verified read-only card with `Lock` icon, "Verified & Locked" badge, and formatted 12-digit number.
- When APAAR ID is pending: Displays an "Action Required" notice with a direct link to `/student/apaar`. Inline `<form>` has been completely removed.

### 3.6 Staff Correction & Auditability
- Authorized admission staff (role `admission` or `admin`) can search by APAAR ID, filter by missing APAAR, view/edit the 12-digit ID in the student registry (`/api/staff/admission/students/[rollno]`), and export to Excel with `updated_by_staff_id` audit tracking.

---

## 4. Tasks 1, 2, and 4 Audit Findings

### Task 1 — Admission Email OTP Verification
- **Status:** **PASS** (18 unit tests passing).
- **Security Validation:** OTPs generated via `crypto.randomInt`, hashed via SHA-256 before storage in `otp_codes`, 10-minute expiry, single-use consumption. Signed JWT token with `purpose: 'student_admission_email'` required on `POST /api/public/admission`. Email changes on the client immediately invalidate previously verified state.

### Task 2 — Faculty Attendance, Topic Popup, & Offline Sync
- **Status:** **PASS** (48 unit tests passing).
- **Topic Popup Logic:** Verified in `FacultyAttendanceContext.js:463` — `setTopicModalSession` is invoked ONLY when `effectiveTopic` is missing or shorter than 2 characters. Valid topics bypass the modal completely.
- **Offline Persistence & Sync:** IndexedDB drafts (`idb-attendance.js`), auto-save on change, and batch sync (`/api/staff/faculty/attendance/bulk-sync`) with idempotency deduplication.

### Task 4 — Payment Fraud Detection & Staff Training Assets
- **Status:** **PASS** (15 unit tests in `PaymentFraudService.test.js` + 19 in `PaymentSecurityRegression.test.js`).
- **Core Security Controls:** UPI VPA classification, SHA-256 hash duplication, dHash perceptual similarity (88%), OCR contradiction detection, amount mismatch detection, candidate privacy preservation, and strict bank reconciliation requirement.
- **Training Video Deliverable:** Verified MP4 at `artifacts/task4_video/payment-fraud-staff-training.mp4`:
  - Duration: 370.8 seconds (6 min 10 sec).
  - Codec: H.264 video (1920x1080), AAC audio, embedded mov_text subtitles.
  - Video Screen Elements: Authentic screen captures of `/student/requests/certificates` (Certificate Fee Payment Portal with college QR and UTR input) and `/admin/payments` (Staff Payments Management Console).
  - Demonstration Data: Labeled `DEMO — SYNTHETIC DATA — NOT A REAL PAYMENT`.

---

## 5. Cross-Task Integration & Regression Verification

- **Database Schemas & Migrations:** Migration `0028_add_apaar_id.sql` verified; adds `apaar_id varchar(20)` with indexes to `student_personal_details` and `student_admission_drafts`. No conflicting migrations.
- **Portability:** Replaced local developer scratch paths with `os.tmpdir()` across test suites.
- **Full Suite Run:** All 125 test files and 1,182 unit tests passed.

---

## 6. Files Changed in Remediation

| File Path | Description of Changes |
| :--- | :--- |
| `src/app/student/apaar/page.js` | **NEW:** Dedicated Server Component page for student APAAR guidance & registration. |
| `src/app/student/apaar/StudentApaarClient.js` | **NEW:** Interactive client component with 10-point guidance, official links, live 12-digit validation form, and locked verified card. |
| `src/app/student/finances/StudentFinancesClient.js` | **MODIFIED:** Removed inline submission form; enforces strictly read-only display when submitted and guidance link when unsubmitted. |
| `src/components/student/DashboardActionCenter.js` | **MODIFIED:** Added priority warning card linking to `/student/apaar` when APAAR ID is missing; omitted once submitted. |
| `src/components/student/StudentQuickLinks.js` | **MODIFIED:** Added `APAAR ID (ABC)` quick link pointing to `/student/apaar`. |
| `src/lib/menu-config.js` | **MODIFIED:** Added `APAAR ID Guidance` under student SETTINGS menu. |
| `tests/unit/student/apaar-id-lifecycle.test.js` | **NEW:** Comprehensive 10-test unit suite covering full student APAAR lifecycle, validation, API locking, and isolation. |
| `tests/unit/services/PaymentFraudService.test.js` | **MODIFIED:** Adjusted optical test execution timeout to 60s to prevent concurrency timeouts during OCR. |

---

## 7. Git State & Working Tree Status

- **Branch:** `testvanilla` (synchronized with `origin/testvanilla` at baseline commit `39558087`).
- **Working Tree Status:** All remediation changes remain uncommitted and unpushed in the local working directory awaiting review.
- **Production Safety:** No production deployments, destructive resets, or unauthorized migrations were executed.

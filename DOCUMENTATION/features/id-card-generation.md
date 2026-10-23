# Student ID Card Generation & Management Module

**Feature Name:** Reusable, Role-Based Student ID Card Management & Export  
**Last Updated:** Session 226 (Rebuild with Authoritative Database Workflow & 1-Click Branch Export)  
**Access Matrix:** Initially granted to **Admission Staff**; architecturally extensible to **Scholarship Staff, Faculty, HODs, and Administrators** via RBAC.

---

## 1. Executive Summary

The Student ID Card Management module enables authorized college staff to audit, preview, rectify, and generate institutional student identity cards. Built with Next.js 16 (App Router), `@react-pdf/renderer`, and `ExcelJS`, it supports:
1. **One-Click Branch Dataset Export**: Direct streaming of complete, branch-specific ID card datasets (`.xlsx` and `.csv`) containing authoritative finalized student records without pagination truncation.
2. **Authoritative Student Eligibility Invariant**: Evaluates eligibility exclusively against the persisted `students` table (`student_status = 'ACTIVE'`), verified official roll numbers (`validateRollNo`), promoted photographs (`student_images`), and verified addresses (`student_personal_details`). Admission drafts (`student_admission_drafts`) are strictly excluded.
3. **Physical Card Mirroring & PDF Streaming**: Single and batch multi-page PDF generation matching the canonical KUCET physical card layout (`242pt x 385pt` vertical aspect ratio).

---

## 2. Key Capabilities & Workflow

1. **Authoritative Student Registry & Dynamic Branch Readiness:**
   - Evaluates active finalized students with generated and persisted official roll numbers.
   - Granular filters by canonical academic branch (`CIVIL`, `CSD`, `CSE`, `ECE`, `EEE`, `IT`, `MECH`) and photograph completeness (`AVAILABLE`, `MISSING`).
   - Dynamic branch statistics dashboard computing live totals, photos ready, and photos pending directly from the database.

2. **One-Click Branch Export Engine:**
   - Dedicated export endpoint at `/api/staff/id-cards/export`.
   - Generates predictable filenames: `KUCET_[BRANCH]_ID_CARD_DATA_[BATCH].xlsx` (e.g. `KUCET_CSE_ID_CARD_DATA_2026-2030.xlsx`).
   - Formats headers in Kakatiya Navy with centered metadata columns and auto-fit row heights.
   - Enforces data minimization: exports only the 11 attributes required for ID card production (Roll Number, Full Name, Branch, Batch, Father's Name, Emergency Contact Mobile, Permanent Address, Blood Group, and Photo Reference). Unneeded sensitive PII (Aadhaar, income, caste, religion) is strictly excluded.

3. **Physical Card Mirroring (Interactive Web Preview):**
   - High-fidelity modal preview matching the canonical KUCET physical card layout (`242pt x 385pt` vertical aspect ratio).
   - Navy curved top-left badge with white circular KUCET crest.
   - Header address: Vidyaranyapuri, Warangal 506 009.
   - Red ribbon: `IDENTITY CARD`.
   - Dynamic 3-row grid: `B.Tech (<BRANCH>)`, `H.T. No`, `Academic Year: 2026-2030`.
   - Name in bold crimson, father's name, QR verification code, and Principal signature block (`T.M. Reddy`).
   - Footer permanent address and verified contact mobile number.

4. **Missing Photo Rectification Workflow:**
   - Modal directly integrated into the preview dialog and registry table for uploading or replacing missing student photos.
   - Stores photos via `StorageProvider` (`kucet/students/pfp/[uuid].webp`), updates `student_images.pfp` in the database, and creates structured audit log entries.

---

## 3. Architecture & API Endpoints

| Endpoint | Method | Role / Permission | Description |
| :--- | :--- | :--- | :--- |
| `/api/staff/id-cards` | `GET` | `ID_CARD_VIEW` | Lists student records, branch readiness stats, and preview pagination |
| `/api/staff/id-cards/export` | `GET` | `ID_CARD_GENERATE` | Streams complete branch-specific ID card dataset (`.xlsx` or `.csv`) |
| `/api/staff/id-cards/[rollno]` | `GET` | `ID_CARD_PREVIEW` | Retrieves single student details and generated QR code |
| `/api/staff/id-cards/[rollno]/pdf` | `GET` | `ID_CARD_GENERATE` | Streams single ID card PDF (`inline`) |
| `/api/staff/id-cards/bulk-pdf` | `POST` | `ID_CARD_BULK_GENERATE` | Generates and streams multi-page batch PDF (`attachment`) |
| `/api/staff/id-cards/upload-photo` | `POST` | `ID_CARD_MANAGE_PHOTOS` | Uploads/rectifies student photo with DB persistence and audit trail |

---

## 4. Inviolable Security & Data-Integrity Invariants

- **Authoritative Database Exclusivity:** ID card data is pulled exclusively from the `students`, `student_personal_details`, and `student_images` tables. Mock JSON datasets or unfinalized admission drafts are strictly excluded.
- **Data Minimization:** Export files exclude unmasked Aadhaar numbers, caste categories, income ranges, or passwords.
- **No Roll Numbers or PII as Filenames:** Dynamic uploads use `crypto.randomUUID()` keys.
- **Relative DB Storage Keys:** Preserves `kucet/students/pfp/*` format.
- **Client Image Delivery:** All image previews wrapped through `getAssetUrl(key)`.
- **Zero DOM Props in PDF Renderer:** No HTML DOM events or non-supported attributes attached to `@react-pdf/renderer` elements.
- **Zero Pagination Truncation:** Branch export retrieves all matching records across the entire branch.

# Student ID Card Generation & Management Module

**Feature Name:** Reusable, Role-Based Student ID Card Management & Generation  
**Last Updated:** Session 225  
**Access Matrix:** Initially granted to **Admission Staff**; architecturally extensible to **Scholarship Staff, Faculty, HODs, and Administrators** via RBAC.

---

## 1. Executive Summary

The Student ID Card Management module enables authorized college staff to audit, preview, rectify, and generate institutional student identity cards. Built with `@react-pdf/renderer` and Next.js 16 (App Router), it supports both single real-time PDF generation and high-volume batch multi-page PDF streaming without intermediate disk overhead.

---

## 2. Key Capabilities

1. **Authoritative Student Registry & Audit Filter:**
   - Unified listing across finalized students (`students` table) and verified active drafts (`student_admission_drafts`).
   - Granular filters by academic branch (`CIVIL`, `CSD`, `CSE`, `ECE`, `EEE`, `IT`, `MECH`), photograph completeness (`AVAILABLE`, `MISSING`), address verification status, and contact phone availability.
   - Real-time debounced search by roll number / hall ticket, student name, father's name, and contact phone.

2. **Physical Card Mirroring (Interactive Web Preview):**
   - High-fidelity modal preview matching the canonical KUCET physical card layout (`242pt x 385pt` vertical aspect ratio).
   - Navy curved top-left badge with white circular KUCET crest.
   - Header address: Vidyaranyapuri, Warangal 506 009.
   - Red ribbon: `IDENTITY CARD`.
   - Dynamic 3-row grid: `B.Tech (<BRANCH>)`, `H.T. No`, `Academic Year: 2026-2030`.
   - Name in bold crimson, father's name, QR verification code, and Principal signature block (`T.M. Reddy`).
   - Footer permanent address and verified contact mobile number.

3. **Multi-Role Scoping & Extensibility:**
   - Controlled via `src/lib/rbac.js` permissions:
     - `ID_CARD_VIEW`: Access to management hub and student search.
     - `ID_CARD_PREVIEW`: Interactive card preview modal.
     - `ID_CARD_GENERATE`: Streaming single-card PDF.
     - `ID_CARD_BULK_GENERATE`: Multi-page batch card PDF streaming.
     - `ID_CARD_MANAGE_PHOTOS`: Uploading or replacing student ID photos.
   - Departmental isolation: Admin, Principal, and Admission staff have global access (`null` scope); future HOD/Faculty assignments automatically enforce branch restriction (`user.branch`).

4. **Batch Generation Engine:**
   - Multi-page document generation (`BulkIDCardPDF`) compiling selected students into a single downloadable PDF.
   - Zero temporary disk bloat: streaming byte delivery directly into the HTTP response.

5. **Missing Photo Rectification Workflow:**
   - Drag-and-drop photo upload modal directly integrated into the registry table and preview dialog.
   - Auto-stores via `StorageProvider` (`kucet/students/pfp/*`), updates DB references, and creates structured audit log entries.

---

## 3. Architecture & API Endpoints

| Endpoint | Method | Role / Permission | Description |
| :--- | :--- | :--- | :--- |
| `/api/staff/id-cards` | `GET` | `ID_CARD_VIEW` | Lists student records, summary stats, and pagination |
| `/api/staff/id-cards/[rollno]` | `GET` | `ID_CARD_PREVIEW` | Retrieves single student details and generated QR code |
| `/api/staff/id-cards/[rollno]/pdf` | `GET` | `ID_CARD_GENERATE` | Streams single ID card PDF (`inline`) |
| `/api/staff/id-cards/bulk-pdf` | `POST` | `ID_CARD_BULK_GENERATE` | Generates and streams multi-page batch PDF (`attachment`) |
| `/api/staff/id-cards/upload-photo` | `POST` | `ID_CARD_MANAGE_PHOTOS` | Uploads/rectifies student photo with audit trail |

---

## 4. Security Invariants Followed

- **No Roll Numbers or PII as Filenames:** Dynamic uploads use `crypto.randomUUID()` keys.
- **Relative DB Storage Keys:** Preserves `kucet/students/pfp/*` format.
- **Client Image Delivery:** All image previews wrapped through `getAssetUrl(key)`.
- **Zero DOM Props in PDF Renderer:** No HTML DOM events or non-supported attributes attached to `@react-pdf/renderer` elements.
- **Input Validation:** All POST bodies validated via Zod schemas inside `wrapHandler`.

# KUCET CMS - Universal Naming & Identification Standards

**Last Updated:** August 11, 2026  
**Status:** Mandatory Engineering Standard  
**Scope:** Storage Keys, Random Filenames, Roll Number Generation, and Institutional Asset Identifiers.

---

## 1. High-Level Taxonomy

| Target Artifact | Naming Format | Example | Description |
| :--- | :--- | :--- | :--- |
| **Storage Keys (DB)** | `kucet/<folder>/<uuid>.<ext>` | `kucet/requests/pfp/7a59662b-8a4e-4716-b52a.webp` | Relative storage key stored directly in DB |
| **Uploaded Filenames** | `crypto.randomUUID()` | `d9b1c23f-4e5a-6b7c-8d9e-0f1a2b3c4d5e.jpg` | Cryptographically random UUID |
| **Student Roll Numbers** | `YYKUBBBSSS` | `24KUEC001` | 2-digit Year, College Code, Branch, 3-digit Serial |
| **Institutional Assets** | Logical Namespace | `principal/signature` | Logical key decoupled from physical path |
| **API Endpoints** | `kebab-case` | `/api/clerk/admission/drafts` | RESTful API path structure |
| **SQL Tables** | `snake_case` | `student_personal_details` | Drizzle ORM table definitions |

---

## 2. Storage Key Naming Rules

### A. Relative Storage Key Invariant
All user-uploaded file paths stored in database columns (`pfp`, `signature_url`, `screenshot_url`, `proof_document`) MUST be saved as **canonical relative keys**. 

> [!IMPORTANT]
> DB storage keys MUST NEVER contain local filesystem paths (`C:\...`, `/var/www/...`), host domain names (`https://...`), or hardcoded `public/` / `uploads/` prefixes.

### B. Standard Folder Namespaces (`src/lib/storage-config.js`)
Storage folders are managed centrally by constants:

```javascript
export const STORAGE_FOLDERS = {
  ADMISSION_PFP: 'admission_drafts/pfp',
  ADMISSION_SIGNATURES: 'admission_drafts/signatures',
  REQUESTS_PFP: 'requests/pfp',
  REQUESTS_PROOFS: 'requests/proofs',
  REQUESTS_SIGNATURES: 'requests/signatures',
  CERTIFICATES_PAYMENTS: 'certificates/payments',
  BACKUPS: 'backups',
  INSTITUTION: 'kucet/institution',
};
```

---

## 3. Filename UUID Randomization Invariant

> [!CAUTION]
> **NEVER USE STUDENT ROLL NUMBERS, NAMES, OR EMAILS AS FILENAMES OR CLOUDINARY PUBLIC IDs!**  
> Using student roll numbers as filenames (e.g., `24KUEC001.jpg`) exposes PII, enables browser asset enumeration, causes stale browser caching during image re-uploads, and creates directory collision risks.

### Mandatory Randomization Protocol:
Every file uploaded through the storage layer (`storage.upload()`) must generate a fresh UUID v4 filename:

```javascript
import { randomUUID } from 'crypto';

// Correct Filename Generation
const fileExtension = getFileExtension(file.name); // e.g., 'webp'
const randomizedFilename = `${randomUUID()}.${fileExtension}`;
// Output: "f47ac10b-58cc-4372-a567-0e02b2c3d479.webp"
```

---

## 4. Roll Number Parsing & Alphanumeric Serial Sequences

Student roll numbers follow Kakatiya University's institutional format: **`YYKUBBBSSS`**.

### A. Structure Breakdown

```text
 2 4   K U   E C   0 0 1
 ───   ───   ───   ─────
  │     │     │      │
  │     │     │      └─ 3-Digit Serial Sequence (001 - 999)
  │     │     └──────── Branch Code (EC, CSE, EEE, MEC, CIV)
  │     └────────────── College Code (KU = Kakatiya University)
  └──────────────────── Admission Year (24 = 2024)
```

### B. Parsing Specification & Regular Expression

```javascript
export const ROLL_NUMBER_REGEX = /^(\d{2})(KU)([A-Z]{2,4})(\d{3})$/;

export function parseRollNumber(rollNo) {
  const match = String(rollNo).trim().toUpperCase().match(ROLL_NUMBER_REGEX);
  if (!match) return null;

  const [, yearDigits, collegeCode, branchCode, serialDigits] = match;
  const admissionYear = 2000 + parseInt(yearDigits, 10);
  const serialNo = parseInt(serialDigits, 10);

  return {
    admissionYear,
    collegeCode,
    branchCode,
    serialNo,
    isLateralEntry: false, // Updated by batch rules if applicable
  };
}
```

### C. Lateral Entry (TG ECET) Batch Continuity Rules
Lateral entry students enter directly into the 2nd Academic Year (Semester 3). Their admission year digit reflects their entry calendar year, but their graduation cohort aligns with the regular batch admitted the prior year.

---

## 5. Institutional Asset Logical Keys

Confidential institutional media (principal signatures, college seals, official logos) are identified by **Logical Keys** rather than physical filenames. This decouples business logic from disk storage paths.

### A. Logical Key Registry (`InstitutionAssetService.js`)

| Logical Key | Target Resource | Description |
| :--- | :--- | :--- |
| `principal/signature` | `principal-sign-black.png` | Official Black Ink Signature for Certificates |
| `principal/signature-stamp` | `principal-signStamp.png` | Official Signature with Institutional Stamp |
| `principal/qr` | `principal_ku_qr.png` | QR Verification Endpoint Asset |
| `institution/seal` | `ku-college-seal.png` | Official College Embossed Seal |
| `institution/logo` | `ku-logo.png` | Kakatiya University Primary Logo |
| `institution/college-logo` | `ku-college-logo.png` | KUCET Engineering College Logo |

### B. Non-Overwritable Security Guard
All storage providers (`LocalStorageProvider`, `CloudinaryStorageProvider`) enforce `isInstitutionalAssetPath(key)` checks. Any attempt by public file upload endpoints to overwrite, rename, or delete an institutional asset key is strictly rejected with an `HTTP 403 Forbidden` error.

---

## 6. Cross-References & Related Documentation

- [Engineering Coding Standards](./coding-standards.md)
- [Project Architecture Conventions](./project-conventions.md)
- [Comprehensive Project Lessons Learned](./lessons-learned.md)
- [Old Cloudinary Storage Migration History](../history/old-cloudinary-migration.md)

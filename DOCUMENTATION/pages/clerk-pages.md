# Administrative Clerk Portal Workflows & Interface Specifications

## Overview

The Administrative Clerk Portal (`/clerk/*`) provides specialized workflows for academic admissions, scholarship processing, fee verification, and student document management.

Access is restricted to authenticated users holding `clerk_auth` with designated sub-roles (`admission`, `scholarship`).

---

## Role Segregation & Sub-Route Boundaries

```mermaid
graph TD
    A[Clerk Auth Token] --> B{Check Role Claim}
    
    B -->|role: admission| C[/clerk/admission/*]
    C --> C1[New Student Enrollment]
    C --> C2[View / Edit Student Profiles]
    C --> C3[Certificate Request Approval]
    
    B -->|role: scholarship| D[/clerk/scholarship/*]
    D --> D1[Fee Payment Verification]
    D --> D2[Scholarship Sanction Entry JVD]
    D --> D3[Financial Dues Ledger]
    
    B -->|Unauthorized Access Attempt| E[Redirect to Assigned Role Dashboard]
```

---

## Key Workflows & Components

### 1. Student Admission Management (`ViewEditStudent.js`, `/clerk/admission/new`)
Handles multi-stage enrollment of new students:
- **Admission Draft Staging**: Form progress is continuously auto-saved to the `student_admission_drafts` table, allowing clerks to complete complex multi-step enrollment forms over multiple sessions without losing data.
- **Demographic & Background Fields**: Collects personal details (Name, DOB, Gender, Category, Aadhaar), encrypted mobile numbers, and prior academic background (SSC, Intermediate, EAMCET rank).
- **Auto Roll Number Generator (`autoGenerateRollNumber.js`)**: Computes standardized institutional roll numbers based on admission year, branch code, and entry category (Regular vs Lateral Entry).
- **Media Upload**: Encrypts and uploads student profile photographs and signatures to Cloudinary (`student_images`, `student_signatures`).
- **Draft Finalization**: Upon complete verification, the clerk clicks "Finalize Admission", which executes a DB transaction moving the record from `student_admission_drafts` into active production tables (`students`, `student_personal_details`, `student_academic_background`).

---

### 2. Certificate Requests Review (`/clerk/requests`)
Manages student applications for official certificates:
1. **Application Roster**: Displays pending requests for Bonafide, Custodian, and Transfer Certificates filtered by status (`PENDING`, `APPROVED`, `REJECTED`).
2. **Verification Inspection**: Clerks review student details, fee clearings, and attached purpose documents.
3. **Approval & PDF Generation**: Upon approval (`CERTIFICATE_APPROVE`), the system dynamically generates a PDF certificate stamped with the institution's official logo, principal/clerk digital signatures, and a unique QR verification code linked to `certificate_verifications`.

---

### 3. Payment & Scholarship Verification (`/clerk/scholarship`)
Handles institutional fee collection and government scholarship administration:
- **Fee Payment Entry**: Clerks record manual fee payments (Bank Demand Draft, Cash, Online Transaction ID), assigning official sequential receipt numbers.
- **Jagananna Vidya Deevena (JVD) Sanction Tracking**: Records state government scholarship releases, mapping sanctioned amounts against individual student fee ledgers (`scholarship_sanctions`).
- **Payment Verification (`FEE_VERIFY`)**: Validates pending student payment submissions, updating fee statuses from `PENDING` to `SUCCESS` and issuing digital receipts.

---

## Cross-References

- [Authentication Architecture](../authentication/authentication.md)
- [Authorization System & RBAC Matrix](../authentication/authorization.md)
- [Student Portal Fee Ledger & Receipts](./student-pages.md#6-fee-ledger--receipt-modal-feetransactionhistoryjs)
- [Super Admin Staff Management](./admin-pages.md#2-staff--faculty-account-management-adminmanage-clerks-admincreate-clerk)

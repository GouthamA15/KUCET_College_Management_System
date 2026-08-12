# Digital Certificate Engine Documentation

## 1. Overview & Rendering Pipeline

The **KUCET Digital Certificate Engine** renders tamper-proof, high-resolution PDF certificates on the server using `@react-pdf/renderer`. It generates institutional documents—such as Bonafide, Migration, Transfer, and Conduct certificates—on-the-fly when requested by authorized students or administrative personnel.

Each generated document incorporates cryptographic HMAC-SHA256 signatures, dynamic QR verification codes, embedded institutional seals, and authoritative signatures resolved through `InstitutionAssetService`.

```mermaid
flowchart TD
    A[Student Download Request GET /api/student/requests/download/:id] --> B{Check Auth & Verification}
    B -->|Unverified Email / Missing Auth| C[Return 401 / 403 Error]
    B -->|Verified Student| D[Query `studentRequests` Table]
    
    D --> E{Request Approved & Valid Type?}
    E -->|No| F[Return 403 Not Available]
    E -->|Yes| G[Fetch Student & Academic Info]
    
    G --> H[Generate / Retrieve Cryptographic Cert ID]
    H -->|HMAC-SHA256 Signature| I[Format ID: KUCET-XXXXXXXX]
    I --> J[Generate Verification QR Code Base64]
    
    J --> K[Resolve Brand Assets via InstitutionAssetService]
    K -->|Logo, Seal, Principal Signature| L[Populate Common Certificate Data]
    
    L --> M[Instantiate React-PDF Template]
    M --> N[pdfTemplate.toBuffer Sever-Side Stream]
    N --> O[Return HTTP 200 Response with application/pdf Header]
```

---

## 2. Server-Side PDF Rendering Architecture

Certificate rendering takes place in Next.js Server Components / API Route Handlers (`/api/student/requests/download/[request_id]/route.js`). 

Rather than relying on client-side canvas rendering or headless browser screenshot tools (e.g., Puppeteer), KUCET utilizes `@react-pdf/renderer` to achieve deterministic layout calculation, sub-pixel vector rendering, lightweight memory consumption, and rapid response times.

### Server Component Execution Pattern

```javascript
// Source: src/app/api/student/requests/download/[request_id]/route.js
import React from 'react';
import { pdf } from '@react-pdf/renderer';

// Map request type to specific React-PDF Document Component
const Template = certificateComponents[certRequest.certificate_type];

// Construct props data object with academic info and resolved assets
const certProps = {
  certId: 'KUCET-A7B8C9D0',
  studentName: 'Goutham Rao',
  fatherName: 'Ramesh Rao',
  admissionNo: '22567T0901',
  course: 'CSE',
  academicYear: '2024-25',
  logoUrl: 'data:image/png;base64,...',
  signatureUrl: 'data:image/png;base64,...',
  stampUrl: 'data:image/png;base64,...',
  qrUrl: 'data:image/png;base64,...'
};

// Render React Element into Node Buffer
const pdfBuffer = await pdf(<Template {...certProps} />).toBuffer();

// Return response as downloadable PDF binary
return new NextResponse(pdfBuffer, {
  status: 200,
  headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`
  }
});
```

---

## 3. HMAC-SHA256 Tamper Protection & Public Verification

To eliminate document forgery, every certificate issued by the platform receives an immutable cryptographic **Certificate ID** (`certId`) and an embedded **QR Code**.

```mermaid
sequenceDiagram
    participant S as Student / Portal
    participant API as Download API Route
    participant Crypto as Node crypto Module
    participant V as Public Verification Page (/verify)

    S->>API: Request Approved Certificate Download
    API->>Crypto: Create HMAC-SHA256(roll_no + cert_type + request_id, CERTIFICATE_SECRET)
    Crypto-->>API: Digest Hex String
    API->>API: Format ID: KUCET- + Hash[0..8].toUpperCase()
    API->>API: Persist certId into `student_requests.generated_certificate_id`
    API->>API: Generate QR Code containing URL: /verify?id=KUCET-XXXXXXXX&roll=22567T0901
    API-->>S: Return PDF Document with Embedded QR & Cert ID

    Note over V: Third party scans QR Code on physical/printed certificate
    V->>API: GET /api/public/verify?id=KUCET-XXXXXXXX
    API-->>V: Return Authentic Student & Certificate Details
```

### Cryptographic Hash Generation Formula
```javascript
const SECRET_SALT = process.env.CERTIFICATE_SECRET || "institutional_default_salt";
const hash = crypto.createHmac('sha256', SECRET_SALT)
                   .update(`${student.roll_no}-${certRequest.certificate_type}-${requestIdNum}`)
                   .digest('hex');
const certId = `KUCET-${hash.substring(0, 8).toUpperCase()}`;
```

---

## 4. Supported Certificate Types & Template Specifications

The system ships with 9 dedicated `@react-pdf/renderer` templates located in `src/pdf/templates/`.

| Certificate Type | Template File | Primary Use Case & Key Fields Rendered |
| :--- | :--- | :--- |
| **Bonafide Certificate** | `BonafideCertificatePDF.js` | General proof of enrollment, Passport, Bank Loan, Bus Pass, Scholarship applications. Displays Year, Semester, Attendance %, and Purpose. |
| **Custodian Certificate** | `CustodianCertificatePDF.js` | Verification that original certificates are deposited with the college administration. Displays Hall Ticket number and custody roster. |
| **Study Conduct Certificate** | `StudyConductCertificatePDF.js` | Attestation of student character and conduct during course duration (`Satisfactory` / `Good`). |
| **Migration Certificate** | `MigrationCertificatePDF.js` | Inter-university transfers and higher education admissions. Issued upon graduation or program migration. |
| **Course Completion Certificate** | `CourseCompletionCertificatePDF.js` | Provisional completion proof prior to convocation degree distribution. Includes completion year and course branch. |
| **Income Tax (IT) Certificate** | `IncomeTaxCertificatePDF.js` | Parents' IT return submission proving tuition fee payments (`₹35,000/-`). |
| **Transfer Certificate (TC)** | `TransferCertificatePDF.js` | Formal withdrawal or graduation clearance record. Includes conduct rating and admission details. |
| **No Objection Certificate** | `NoObjectionCertificatePDF.js` | Internships, industry projects, or external academic visits. Includes date ranges (`fromDate`, `toDate`). |
| **ID Card** | `IDCardPDF.js` | Official institutional identity card with barcode, profile photo, emergency contact, and blood group. |

---

## 5. Multi-Purpose Bonafide Rules & Purpose Formatting

Bonafide certificates are requested for diverse administrative needs. The system implements dynamic purpose parsing and title formatting using `src/lib/certificate-utils.js`.

### Purpose Parsing Logic
When a student requests a Bonafide Certificate, the `purpose` field in `student_requests` can store either a plain string or a JSON payload containing structured purpose data:

```javascript
// Source: src/lib/certificate-utils.js
export function parsePurpose(purposeStr) {
  if (!purposeStr) return { purpose_type: null, purpose_custom: null };
  const parsed = safeJsonParse(purposeStr, null);
  if (parsed && typeof parsed === 'object') {
    return {
      purpose_type: parsed.purpose_type || null,
      purpose_custom: parsed.purpose_custom || null
    };
  }
  return { purpose_type: purposeStr, purpose_custom: null };
}
```

### Dynamic Document Naming
- If `purpose_type` is `'Other'` and `purpose_custom` is `'State Bank Education Loan'`, `formatCertificateName()` returns:  
  `"Bonafide Certificate (State Bank Education Loan)"`
- File attachment names are sanitized for HTTP Content-Disposition headers:  
  `Bonafide_Certificate_(State_Bank_Education_Loan)_22567T0901.pdf`

---

## 6. Institutional Asset Resolution (`InstitutionAssetService`)

Certificates require high-resolution vector logos, official stamps, and principal signatures. The `InstitutionAssetService` provides a unified resolution layer with automated fallback chains.

```mermaid
graph TD
    Req[Certificate Render Request] --> AssetReq[Request Asset Key e.g., principal/signature]
    AssetReq --> Service[InstitutionAssetService.getAssetDataUrl]
    
    Service --> CacheCheck{In-Memory Base64 Cache?}
    CacheCheck -->|Cache Hit| Return[Return Data URL: data:image/png;base64...]
    CacheCheck -->|Cache Miss| ResolveFile[Resolve File from Storage / Local Disk]
    
    ResolveFile --> FileCheck{File Exists?}
    FileCheck -->|Yes| ReadBuffer[Read Image Buffer & Detect MIME Type]
    FileCheck -->|No| Fallback[Try Secondary Key e.g. signature-stamp / ku-logo.png]
    
    Fallback --> ReadBuffer
    ReadBuffer --> Enc[Convert to Base64 & Cache]
    Enc --> Return
```

### Asset Fallback Chain & Supported Keys

```javascript
// Asset resolution in certificate download handler:
const logoUrl = await InstitutionAssetService.getAssetDataUrl('institution/logo') 
    || await getBase64Image(getAssetUrl('/assets/ku-logo.png'));

const signatureUrl = await InstitutionAssetService.getAssetDataUrl('principal/signature') 
    || await InstitutionAssetService.getAssetDataUrl('principal/signature-stamp');

const stampUrl = await InstitutionAssetService.getAssetDataUrl('institution/seal');
```

- **MIME Detection**: Buffers are inspected for magic headers (`0xFF 0xD8` for JPEG, `0x89 0x50` for PNG) to construct valid base64 data URIs (`data:image/png;base64,...`) for seamless embedding into `@react-pdf/renderer` `<Image />` elements.

---

## 7. Cross-References

- Student Requests Workflow: [requests.md](./requests.md)
- Admissions System: [admissions.md](./admissions.md)
- System Storage Architecture: [06_STORAGE_SYSTEM.md](../storage/06_STORAGE_SYSTEM.md)
- Database Schema Documentation: [03_DATABASE.md](../database/03_DATABASE.md)

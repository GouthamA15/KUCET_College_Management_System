# 🗄️ Database Architecture & Drizzle ORM Data Layer

This document details the database architecture of the **KUCET College Management System (CMS)**, focusing on the TiDB Cloud MySQL distributed database engine, Drizzle ORM integration, modular schema structures, serverless connection pooling, and read-time storage key resolution patterns.

---

## 📌 Related Documentation
- [Master Index](../README.md)
- [System Architecture](./system-architecture.md)
- [Backend Architecture](./backend.md)
- [Storage Architecture](./storage.md)
- [Deployment Architecture](./deployment.md)

---

## ☁️ Database Architectural Overview

The persistence tier is built on **TiDB Cloud**, a distributed MySQL-compatible Hybrid Transactional/Analytical Processing (HTAP) database platform.

### Core Architectural Guarantees
- **MySQL Protocol Compatibility**: Fully compatible with MySQL 8.0 drivers (`mysql2/promise`) and standard SQL syntax.
- **Horizontal Elasticity**: Scales computational nodes independently from storage nodes, handling high-concurrency admission spikes and internal exam mark entries without lock contention.
- **ACID Transactions**: Guarantees distributed transactional isolation required for complex operations like roll number generation and fee ledger reconciliation.
- **SSL/TLS 1.2 Mandatory Security**: All database connections require TLS 1.2 encryption with verified certificate authority checks.

---

## 🛠️ Drizzle ORM Integration

Database interaction is managed via **Drizzle ORM** (`drizzle-orm/mysql2`), which provides compile-time type safety with zero runtime overhead.

```
src/db/
├── index.js                      # DB Client initialization & Drizzle instance export
├── schema.js                     # Central schema index re-exporting all modules
├── schema/                       # Domain Bounded Context Schemas
│   ├── identity.js               # Users, Students, Staff, Faculty, Guardians
│   ├── academic.js               # Departments, Courses, Semesters, Subjects, Timetables
│   ├── attendance.js             # Attendance Sessions, Log records, GPS Pins
│   ├── finance.js                # Fee structures, RTF/MTF proceedings, Payments
│   ├── operations.js             # Student requests, Certificates, Notices
│   ├── registry.js               # Admission batches, Roll number sequences
│   ├── security.js               # Sessions, Audit logs, Rate limit tokens
│   └── archive.js                # Soft-deleted records, DR backup snapshots
├── migrate.js                    # Production Drizzle migration execution script
└── backup.js                     # Automated database backup snapshot runner
```

---

## 🗂️ Modular Schemas in `src/db/schema/`

The database schema is divided into 8 modular schema domain files under `src/db/schema/`:

### 1. Identity Domain (`identity.js`)
Manages authentication credentials, user profiles, and institutional entity details.
- `students`: Detailed student registry containing roll number, branch, admission batch, encrypted Aadhaar/mobile numbers, and `added_by_staff_id`.
- `staff_accounts`: Unified identity table for all institutional staff (Faculty, Admission, Scholarship, HOD) with email, hashed password, status flags, pfp, and signature keys.
- `staff_roles`: Institutional role definitions (`FACULTY`, `ADMISSION_CLERK`, `SCHOLARSHIP_CLERK`).
- `staff_account_roles`: Mapping between staff accounts and their assigned institutional roles.
- `staff_academic_affiliations`: Branch/department affiliations for faculty and staff.
- `staff_account_activation_tokens`: Secure 48-hour SHA-256 tokens for new staff password setup.
- `staff_registration_requests`: Pending public staff registration requests for admin approval.
- `guardians`: Parent/guardian contact details and emergency verification records.
- `clerks`: Legacy identity table (retained for backward migration reads).

### 2. Academic Domain (`academic.js`)
Defines the institutional academic structure and scheduling logic.
- `departments`: Branch definitions (e.g., CSE, ECE, EEE, MECH, CIVIL).
- `courses`: Degree programs (B.Tech 4-Year, M.Tech, Lateral Entry).
- `academic_years`: Current academic cycle configurations (e.g., 2025-2026).
- `semesters`: Active semester boundaries, start/end dates, and mark calculation weights.
- `subjects`: Syllabus course subjects, internal/external mark allocation rules.
- `timetables`: Daily classroom schedules, period timings, and assigned faculty IDs.

### 3. Attendance Domain (`attendance.js`)
Tracks real-time classroom attendance sessions and verification logs.
- `attendance_sessions`: Faculty-initiated attendance sessions storing session PIN, branch, semester, expiry time.
- `attendance_logs`: Individual student attendance records (`PRESENT`, `ABSENT`, `ON_DUTY`) with timestamp.
- `gps_pins`: Campus GPS coordinate boundaries used to verify physical proximity during session submission.

### 4. Finance Domain (`finance.js`)
Manages tuition fees, payments, and government scholarship reimbursements.
- `fee_structures`: Year-wise tuition, hostel, exam, and library fee breakdown by branch.
- `scholarships`: Government scholarship application tracking (ePASS / Telangana ePASS).
- `rtf_proceedings`: Reimbursement of Tuition Fee (RTF) government proceeding release records.
- `mtf_proceedings`: Maintenance Fee (MTF) student bank transfer records.
- `payments`: Fee transaction ledger storing payment receipt numbers, gateway responses, and payment dates.

### 5. Operations Domain (`operations.js`)
Handles student request workflows and digital certificate issuance.
- `student_requests`: Student profile modification requests, fee extension applications, bonafide requests.
- `certificates`: Issued digital certificates storing verification QR codes and PDF document relative keys.
- `notifications`: Institutional notice board postings and target recipient groups.
- `institution_assets`: Logical asset keys mapping to official logos, stamps, and principal signatures.

### 6. Registry Domain (`registry.js`)
Manages student admissions and roll number generation logic.
- `roll_number_sequences`: Atomic incrementing counters for branch-specific roll number generation.
- `admission_batches`: Admission year configurations (e.g., 2026 B.Tech Batch).
- `draft_admissions`: Intermediate application drafts uploaded during online admission drives.

### 7. Security Domain (`security.js`)
Enforces system governance, auditing, and rate limiting.
- `sessions`: Active JWT sessions, refresh tokens, IP addresses, user agent strings.
- `audit_logs`: Immutable security audit trail recording user action, target ID, payload before/after.
- `rate_limits`: Token bucket rate-limiting counters for API routes.

### 8. Archive Domain (`archive.js`)
Provides soft deletion recovery and historical snapshot archiving.
- `archived_students`: Soft-deleted student records stored prior to purge operations.
- `archived_attendance`: Historical attendance logs migrated to long-term storage tables.
- `backup_logs`: System backup execution history and archive bundle metadata.

---

## ⚡ Connection Pooling & Serverless Resiliency

Because Next.js route handlers execute in a serverless/stateless environment, database connections are managed via a serverless-optimized pool in `src/lib/db.js`.

### Connection Configuration Specification (`src/lib/db.js`)

```javascript
import mysql from 'mysql2/promise';

let pool;

export function getDb() {
  if (!pool) {
    const isTiDB = process.env.DB_HOST?.includes('tidbcloud.com') || process.env.DATABASE_URL?.includes('tidbcloud.com');
    
    const poolConfig = {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      port: Number(process.env.DB_PORT) || 3306,
      dateStrings: true,               // Prevents automatic UTC timezone mutations
      waitForConnections: true,
      connectionLimit: 3,              // Optimized limit per serverless execution context
      queueLimit: 0,
      enableKeepAlive: true,           // Prevents firewall connection drops
      keepAliveInitialDelay: 10000,     // 10s initial ping
      idleTimeout: 30000,              // 30s idle timeout to release idle sockets
      maxIdle: 0,
    };

    if (process.env.DB_SSL === 'true' || isTiDB) {
      poolConfig.ssl = {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
      };
    }

    pool = mysql.createPool(poolConfig);
  }
  return pool;
}
```

### Resilient Query Execution Wrapper
To protect against intermittent cloud connection resets (`ECONNRESET`, `PROTOCOL_CONNECTION_LOST`), queries execute through an automatic retry wrapper:

```javascript
export async function query(sql, params, retries = 2) {
  const db = getDb();
  // Convert any undefined parameters to null to satisfy mysql2 strict mode
  const sanitizedParams = params ? params.map(p => p === undefined ? null : p) : params;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const [rows] = await db.execute(sql, sanitizedParams);
      return rows;
    } catch (error) {
      const isConnectionError = error.code === 'ECONNRESET' || error.code === 'PROTOCOL_CONNECTION_LOST';
      if (isConnectionError && attempt < retries) {
        console.warn(`[DB] Connection reset detected. Retrying attempt ${attempt + 1}/${retries}...`);
        await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }
}
```

---

## 🖼️ Read-Time Storage Key URL Resolution

A fundamental invariant of the KUCET CMS database architecture is that **database tables NEVER store absolute URLs or domain endpoints**.

### Key Invariant Principle
- **Database Column Stores**: Relative immutable keys only (e.g., `kucet/students/pfp/b3f96f9f4d51487fb2d69fce.webp`).
- **Application Resolves at Read-Time**: API handlers and frontend components convert keys to browser-ready CDN or local file URLs dynamically using `getAssetUrl()` from `src/lib/assets.js`.

```javascript
// Database Record
const studentRecord = {
  roll_number: '21051A0501',
  photo_key: 'kucet/students/pfp/b3f96f9f4d51487fb2d69fce.webp' // Relative Key Only
};

// API Handler / Service Read-Time Resolution
import { getAssetUrl } from '@/lib/assets';

const studentResponse = {
  ...studentRecord,
  photo_url: getAssetUrl(studentRecord.photo_key) 
  // Resolves to: "https://res.cloudinary.com/djs0ry74r/image/upload/f_auto,q_auto/kucet/students/pfp/b3f96f9f4d51487fb2d69fce.webp"
  // OR in dev local mode: "/api/assets/view/kucet/students/pfp/b3f96f9f4d51487fb2d69fce.webp"
};
```

### Why This Architecture is Critical
1. **Environment Portability**: Moving from local development to production VPS or changing S3 bucket names requires **zero database updates**.
2. **CDN Transformation Flexibility**: On-the-fly Cloudinary image optimization parameters (`f_auto,q_auto`) can be modified globally without database migrations.
---

## 🛡️ Production Database Backup & Disaster Recovery Engine

The KUCET CMS maintains a robust, zero-data-loss database backup architecture supporting both self-hosted VPS MySQL deployments and distributed TiDB Cloud clusters:

### Key Operational Architecture
- **Persistent Storage Directory**: `DB_BACKUP_PATH=/var/kucet-db-backup` (mounted into the application container; with local development fallback to `./backups`).
- **Automated Schedule**: Daily at **02:30 AM** VPS local time (`30 2 * * *`) via host crontab and `DEPLOYMENT_PACKAGE/SCRIPTS/nightly-backup.sh`.
- **14-Day Retention Window**: Automatically prunes snapshots older than 14 days while **strictly preserving the latest valid backup** regardless of age.
- **Atomic Dump & Gzip Compression**: Backups are written to temporary `.sql.tmp` files, validated for SQL table structure headers, and compressed to Gzip-9 (`.sql.gz`).
- **Cryptographic SHA-256 Verification**: Post-compression SHA-256 hash is computed and stored alongside the archive (`.sha256` sidecar) and tracked in `database_backup_logs`.
- **Guarded Safe Restoration**: Super Admin panel (`/admin/infrastructure?tab=backups`) allows on-demand backups, secure downloads, and guarded database restoration requiring exact typing of the phrase `RESTORE` with an **automated emergency pre-restore snapshot** taken prior to applying changes.

For full technical specifications, see [Database Backup Strategy](../database/backup-strategy.md).

---

> 💡 **Next Steps**: Learn how file failovers work in [Storage Architecture](./storage.md) or explore host container configurations in [Deployment Architecture](./deployment.md).

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

The database schema is partitioned into 8 modular schema domain files under `src/db/schema/`:

### 1. Identity Domain (`identity.js`)
Manages authentication credentials, user profiles, and institutional staff/student accounts.
- `students`: Core student registry with roll number, branch, admission batch, encrypted Aadhaar/mobile numbers, and status flags.
- `staff_accounts`: Unified identity table for institutional staff (Faculty, Admission, Scholarship, HOD) with email, password hash, status, pfp, and signature keys.
- `staff_roles`: Institutional role definitions (`FACULTY`, `ADMISSION_CLERK`, `SCHOLARSHIP_CLERK`).
- `staff_account_roles`: Mapping between staff accounts and assigned institutional roles.
- `staff_academic_affiliations`: Department and program affiliations for faculty and staff.
- `staff_account_activation_tokens`: Secure SHA-256 tokens for new staff password setup.
- `staff_registration_requests`: Pending public staff registration requests for admin approval.
- `principal`: Super admin credentials and security audit timestamps.
- `user_sessions`: Active user session registry, device metadata, and remote revocation flags.
- `refresh_tokens`: Rotatable refresh token hashes with replacement tracking and revocation timestamps.
- `otp_codes`: Ephemeral email OTP verification codes.
- `password_reset_tokens`: Time-limited password reset tokens.

### 2. Academic Domain (`academic.js`)
Defines the institutional academic structure, syllabus, and calendar.
- `academic_departments`: Branch definitions (e.g., CSE, ECE, EEE, INF, MEC, CIV).
- `academic_programs`: Degree programs (e.g., B.Tech 4-Year, M.Tech, TG ECET Lateral).
- `semesters`: Active semester configurations and mark calculation weights.
- `syllabus_structure`: Curriculum course structure by branch, regulation, and semester.
- `syllabus_subjects`: Syllabus course subjects, theory/lab classification, and credits.
- `academic_calendar`: Institutional working days, instructional periods, and holidays.

### 3. Attendance Domain (`attendance.js`)
Tracks real-time classroom attendance sessions and verification logs.
- `attendance_sessions`: Faculty-initiated attendance sessions storing dynamic 4-digit PIN, branch, semester, expiry time.
- `student_attendance`: Individual student attendance records (`PRESENT`, `ABSENT`, `NCC`, `MEDICAL`) with timestamp.
- `attendance_session_logs`: Immutable attendance audit log of session actions.

### 4. Finance Domain (`finance.js`)
Manages tuition fees, payments, and government scholarship reimbursements.
- `student_fee_payments`: Student fee transactions, payment hashes, amounts, and dates.
- `scholarship_sanctions`: Government scholarship sanctions (Telangana ePASS RTF/MTF proceedings).
- `scholarship_windows`: Active scholarship application windows.

### 5. Operations Domain (`operations.js`)
Handles student request workflows, timetables, marks, and digital certificates.
- `student_marks`: Internal assessment (Mid-1, Mid-2, Lab, Record) marks with optimistic concurrency versioning.
- `branch_config`: Branch-specific mid exam and assignment mark limits and lock states.
- `branch_timetable`: Semester timetable grid mapping day of week and period to subjects and faculty.
- `faculty_hod_assignments`: Department Head (HOD) appointments with date ranges and active flags.
- `faculty_hod_requests`: Faculty HOD elevation requests.
- `faculty_subject_assignments`: Faculty-to-subject teaching assignments.
- `faculty_subject_interests`: Faculty elective/subject teaching preferences.
- `faculty_substitutions`: Temporary faculty substitution arrangements.
- `student_requests`: Student certificate (Bonafide, Custodian, Transfer) and profile update requests.
- `student_request_images`: Payment receipt screenshots attached to student requests.
- `certificate_verifications`: Public QR code certificate verification lookup logs with IP/geo tracking.
- `certificate_verifications_archive`: Long-term archive for verification logs.
- `bugReports`: Bug and feature request feedback submissions.
- `database_backup_logs`: Backup execution log tracking filename, file size, SHA-256 checksum, and status.

### 6. Registry Domain (`registry.js`)
Manages student admissions and roll number generation logic.
- `student_personal_details`: Sensitive demographic data (Aadhaar, parent names, addresses, income).
- `student_academic_background`: Qualifying exam marks, ranks, and previous college records.
- `student_admission_drafts`: Multi-stage admission applications (`DRAFT`, `PROCESSED`, `FINALIZED`, `REJECTED`).
- `admission_status_history`: Immutable state transition ledger for admission draft decisions.
- `student_images`: Official student profile photos (`pfp`).
- `student_signatures`: Official student signatures.
- `student_profile_requests`: Profile data and photo update requests.
- `student_import_logs`: Excel bulk student import execution logs.

### 7. Security Domain (`security.js`)
Enforces system governance, auditing, rate limiting, and push notifications.
- `system_configs`: Dynamic system configuration key-value store.
- `audit_logs`: Immutable security audit trail recording user action, target ID, and payload diffs.
- `rate_limits`: Database token bucket rate-limiting counters.
- `security_events`: Security alert triggers (failed logins, brute force attempts, proxy violations).
- `security_notifications`: User-directed in-app security notifications.
- `notification_preferences`: User push and email notification settings.
- `push_subscriptions`: Browser Web Push (VAPID) endpoint subscriptions.
- `idempotency_keys`: Idempotency token storage preventing duplicate mutating requests.

### 8. Archive Domain (`archive.js`)
Provides soft deletion recovery and long-term academic record archival.
- `archive_students`: Archived student registry entries.
- `archive_student_personal_details`: Archived demographic and personal details.
- `archive_student_academic_background`: Archived qualifying marks.
- `archive_student_marks`: Archived internal marks records.
- `archive_student_attendance`: Archived student attendance records.
- `archive_attendance_sessions`: Archived attendance sessions.
- `archive_student_payments`: Archived financial transaction logs.
- `archive_operations_log`: Historical log of archive and restore operations.
- `archive_retention_policies`: Automated data retention policies by domain.

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

### Storage Architecture & Volume Configuration
- **Persistent Host Directory**: Backups reside on the VPS host at `/var/kucet-db-backup`.
- **Docker Mount & Writable Permissions**: The directory is mounted into the application container using Docker Compose:
  ```yaml
  environment:
    - DB_BACKUP_PATH=/app/backups
  volumes:
    - /var/kucet-db-backup:/app/backups
  ```
- **File Ownership Security**: The host directory (`/var/kucet-db-backup`) MUST be owned by or writable by the container's `nextjs` user (`UID 1001`, `GID 1001`), completely avoiding insecure `chmod 777` permissions. 
- **Application Context**: The application correctly accesses `/app/backups` internally, decoupling the Node.js implementation from the host machine's exact directory path.

### Lifecycle & Retention
- **Automated Schedule**: Daily at **02:30 AM** VPS local time (`30 2 * * *`) via host crontab and `nightly-backup.sh`.
- **14-Day Retention Window**: Automatically prunes snapshots older than 14 days while **strictly preserving the latest valid backup** regardless of age to guarantee restoration fallback.
- **Atomic Dump & Gzip Compression**: Backups are written to temporary `.sql.tmp` files, validated for SQL table structure headers, and compressed to Gzip-9 (`.sql.gz`).
- **Cryptographic SHA-256 Verification**: Post-compression SHA-256 hash is computed and stored alongside the archive (`.sha256` sidecar) and tracked in `database_backup_logs`.

### Operational Verification Procedure
To manually verify the backup pipeline on the VPS:
1. Initialize a manual backup from the Admin Dashboard or via the `DatabaseBackupService.createBackup()` method.
2. Ensure the resulting `.sql.gz` file is generated inside `/var/kucet-db-backup` on the host machine.
3. Validate ownership (`ls -ld`) to confirm it is not root-owned (should be `1001:1001`).
4. Ensure the `.sha256` sidecar file is also correctly generated next to the archive.

---

## 🔌 Redis Architecture & Real-time Connectivity

Real-time pub/sub features and caching utilize **Upstash (Serverless)** or **Self-Hosted Redis Container**.
- **Docker Network Resolution**: When running Redis within the `docker-compose.yml` stack, the application connects via the internal service name `redis://redis:6379`.
- **Localhost Fallback Prohibition**: `127.0.0.1:6379` is actively prevented inside `.env.production` to avoid unreachable connection attempts from inside the isolated `app` container, saving system resources and mitigating `ECONNREFUSED` connection spam.

---

> 💡 **Next Steps**: Learn how file failovers work in [Storage Architecture](./storage.md) or explore host container configurations in [Deployment Architecture](./deployment.md).

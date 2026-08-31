# 🏗️ High-Level System Architecture

This document provides a comprehensive specification of the **KUCET College Management System (CMS)** high-level system architecture, Domain-Driven Design (DDD) organization, core technology stack integrations, dual-environment architecture, and runtime patterns.

---

## 📌 Related Documentation
- [Master Index](../README.md)
- [Frontend Architecture](./frontend.md)
- [Backend Architecture](./backend.md)
- [Database Architecture](./database.md)
- [Storage Architecture](./storage.md)
- [Real-Time WebSocket System](./realtime-system.md)
- [Deployment Architecture](./deployment.md)

---

## 🏛️ Architectural Overview & Design Philosophy

The KUCET CMS architecture is engineered around the principles of **Domain-Driven Design (DDD)**, **Zero-Trust API Security**, **Data Safety & Immutability**, and **High-Availability Multi-Service Resiliency**. Rather than relying on a monolithic monolith or fragmented microservices, KUCET CMS uses a **Modular Monolith** architecture deployed inside Next.js 16 (App Router) on Node.js 20 LTS, supplemented by dedicated standalone services for real-time WebSocket ingress and reverse proxy routing.

```text
┌───────────────────────────────────────────────────────────────────────────────────┐
│                                   KUCET CMS UI                                    │
│             (Student Portal | Faculty & HOD | Staff Portals | Super Admin)        │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │ HTTPS / WSS Ingress
                                          ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                 Tailscale Funnel (HTTPS Termination & Public Ingress)              │
│                                         │
│                 Nginx Reverse Proxy (:80) — kucet-cms-proxy                       │
│                 - /socket.io/          -> kucet-cms-realtime (:4000)              │
│                 - /internal_uploads/   -> Local NVMe Storage (X-Accel-Redirect)   │
│                 - /api, /admin, etc.   -> kucet-cms-app (:3000)                   │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │
                                          ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                       Next.js 16 App Router API Layer                             │
│                      (wrapHandler Zero-Trust Zod Middleware)                      │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    │                                           │
                    ▼                                           ▼
┌───────────────────────────────────────┐   ┌───────────────────────────────────────┐
│        Domain Services Layer          │   │           Domain Event Bus            │
│ (Student, Faculty, Finance, etc.)     │   │      (EventBus.js Async Ingress)      │
└───────────────────┬───────────────────┘   └───────────────────┬───────────────────┘
                    │                                           │
          ┌─────────┴─────────┐                       ┌─────────┴─────────┐
          ▼                   ▼                       ▼                   ▼
┌──────────────────┐ ┌──────────────────┐   ┌──────────────────┐ ┌──────────────────┐
│  MySQL 8.0 (Prod)│ │  Redis 7 (AOF)   │   │ Socket.IO Server │ │ Failover Storage │
│  TiDB Cloud (Dev)│ │  Pub/Sub Broker  │   │  (:4000 Service) │ │ Local / Cloud   │
└──────────────────┘ └──────────────────┘   └──────────────────┘ └──────────────────┘
```

---

## 🌐 Dual-Environment Architectural Split

The system operates across two clearly distinguished environments:

### 1. Development & Preview Environment (Cloud)
- **Application Runner:** Render Cloud Web Service / Local Next.js Turbopack (`npm run dev`).
- **Database Engine:** TiDB Cloud Serverless (MySQL 8.0 wire-compatible HTAP).
- **Primary Media Storage:** Cloudinary CDN with signed uploads.
- **Cache & Rate Limiting:** Process In-Memory LRU Map / MySQL `rate_limits` table fallback.
- **Real-Time:** In-memory socket emitter / Supabase broadcast channel.

### 2. Production Environment (Self-Hosted Physical Server / VPS)
- **Host Infrastructure:** Self-Hosted HP Pro Tower 280 G9 PCI Desktop PC / Hostinger Ubuntu 24.04 LTS VPS (8GB RAM, 468GB NVMe SSD).
- **Container Architecture:** Multi-Service Docker Compose stack (`deployment_package`):
  1. `kucet-cms-app`: Next.js 16 Standalone Server (Port 3000).
  2. `kucet-cms-realtime`: Dedicated Node.js 20 Socket.IO Server (Port 4000).
  3. `kucet-cms-proxy`: Nginx Alpine Gateway (Port 80).
  4. `kucet-cms-db`: MySQL 8.0.46 InnoDB Database (Port 3306).
  5. `kucet-cms-redis`: Redis 7-Alpine with AOF persistence (Port 6379).
  6. `kucet-cms-monitor`: Uptime Kuma monitoring container (Port 3001).
- **Public Ingress:** Tailscale Funnel HTTPS public endpoint proxying to local Nginx port 80.
- **Primary Storage:** High-speed persistent NVMe volume (`/var/www/kucet-storage`) mounted directly to container `/app/storage`.
- **Database Backups:** Automated nightly gzip snapshots (`/var/kucet-db-backup`) with SHA-256 integrity verification.

---

## 📦 Domain-Driven Design (DDD) Layout

The system business logic is strictly partitioned into **8 Bounded Contexts**, each isolating database schemas, service logic, and domain event boundaries:

```text
src/
├── db/schema/                  # Database Schema Definitions
│   ├── identity.js             # User accounts, staff_accounts, roles, affiliations
│   ├── academic.js             # Departments, programs, semesters, subjects, syllabus
│   ├── attendance.js           # Sessions, logs, GPS/PIN verification
│   ├── finance.js              # Fee payments, scholarship sanctions, RTF/MTF
│   ├── operations.js           # Student requests, marks, certificates, timetable
│   ├── registry.js             # Admission drafts, admission_status_history, roll numbers
│   ├── security.js             # user_sessions, refresh_tokens, audit logs
│   └── archive.js              # Soft-deleted records & disaster recovery snapshots
└── services/                   # Business Logic Domain Services
    ├── identity/               # StudentService, StudentProfileService, StaffRegistrationService
    ├── academic/               # FacultyService, AcademicCalendarService
    ├── attendance/             # AttendanceService
    ├── finance/                # FinanceService, ScholarshipService
    ├── archive/                # ArchiveRestoreService, DatabaseBackupService
    ├── security/               # SecurityService, PushNotificationService
    └── storage/                # MediaPromotionService, OrphanMediaService
```

### Bounded Context Overview

| Domain Module | Primary Responsibilities | Core Service Classes | Target Schema Files |
| :--- | :--- | :--- | :--- |
| **Identity** | User authentication, RBAC profiles, staff onboarding & activation | `StaffRegistrationService.js`, `StudentService.js` | [`identity.js`](../database/schema.md) |
| **Academic** | Branch config, semester timetables, faculty assignments & HOD matrix | `FacultyService.js`, `AcademicCalendarService.js` | [`academic.js`](../database/schema.md) |
| **Attendance** | Live classroom sessions, GPS + PIN verification, offset calculation | `AttendanceService.js` | [`attendance.js`](../database/schema.md) |
| **Finance** | Fee collection, scholarship proceedings (RTF/MTF), payment hashes | `FinanceService.js`, `ScholarshipService.js` | [`finance.js`](../database/schema.md) |
| **Operations** | Digital certificates, requests, internal assessment marks entry | `InstitutionAssetService.js` | [`operations.js`](../database/schema.md) |
| **Registry** | Admission draft verification, soft rejections, roll number assignment | `StudentService.js` | [`registry.js`](../database/schema.md) |
| **Security** | Active sessions, token refresh, audit logging, VAPID Web Push | `SecurityService.js`, `PushNotificationService.js` | [`security.js`](../database/schema.md) |
| **Archive** | Long-term archival, automated backup snapshots, restoration runner | `ArchiveRestoreService.js`, `DatabaseBackupService.js` | [`archive.js`](../database/schema.md) |

---

## 🛠️ Core Technology Stack Components

### 1. Next.js 16 App Router & React 19 Engine
- **Server Components (RSC):** Renders heavy data-fetching components on the server with zero client JS bundle bloat.
- **Server Actions & wrapHandler:** Zero-trust Zod-validated mutation layer with automatic error formatting and audit logging.
- **Node.js 20 LTS Runtime:** Modern ESM, `AsyncLocalStorage` request isolation, and native Web Crypto APIs.

### 2. Persistence Layer: MySQL 8.0 (Prod) & TiDB Cloud (Dev)
- **Protocol Parity:** 100% standard MySQL 8.0 syntax via `mysql2/promise` driver and Drizzle ORM.
- **ACID Transactions:** Row-level locking (`SELECT ... FOR UPDATE`) in admission finalization and roll number assignment.
- **Strict Data Safety:** Soft-deletions on drafts (`status = 'REJECTED'`), foreign key `ON DELETE SET NULL` guards on student references.

### 3. Real-Time WebSocket & Redis Pub/Sub Gateway
- **Standalone Socket Server:** Node.js 20 Socket.IO daemon (`kucet-cms-realtime`) on port 4000.
- **Redis Pub/Sub Transport:** Central `kucet:realtime:events` channel receiving broadcasts from Next.js mutations.
- **CircuitBreaker Fail-Safe:** Real-time broadcasting is non-blocking; database commits succeed even if Redis/WebSockets are unreachable.

### 4. Strategy Pattern Storage Provider
- **Polymorphic Engine:** Unified interface supporting Local NVMe disk (`LocalStorageProvider`), Cloudinary CDN (`CloudinaryStorageProvider`), and S3/R2 (`S3StorageProvider`).
- **Private Asset Authorization:** All sensitive files (PII photos, signatures, fee receipts) routed through secure authorization proxy at `/api/assets/view/[...path]` with optional Nginx `X-Accel-Redirect`.

---

## 🔄 Cross-Cutting System Concerns

1. **Authentication & Authorization:** Handled via HTTP-only JWT cookies (`admin_auth`, `staff_auth`, `student_auth`) verified in `src/proxy.js` with automated silent token refresh.
2. **Audit Logging:** Mutating operations dispatch audit events asynchronously to `audit_logs` table.
3. **Structured Logging:** Structured JSON logs via `@/lib/logger` (Pino) with automatic PII redaction and request trace IDs.
4. **Resilient Data Backup:** Nightly 02:30 AM compressed `.sql.gz` backups with SHA-256 checksums and automated 14-day retention pruning.

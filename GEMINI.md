# KUCET College Management System - Technical Index & Core Architecture

**System Version:** Session 205 Production Release  
**Last Updated:** August 11, 2026  
**Status:** Stable / Production-Ready  
**Test Suite Verification:** 39 test files (294 unit & integration tests) — 100% PASSING

---

## 1. Executive Project Overview

The **KUCET College Management System (CMS)** is an enterprise web platform built with **Next.js 16 (App Router)**, **React 19**, and **Tailwind CSS 4** for Kakatiya University College of Engineering and Technology. The system orchestrates the complete academic, administrative, and financial lifecycle across four primary institutional roles: **Super Admin**, **Head of Department (HOD)**, **Clerk/Faculty**, and **Student**.

---

## 2. Master Documentation Index (`/DOCUMENTATION`)

For detailed technical standards, architectural decision records, incident forensics, and development guidelines, refer to the canonical knowledge base in `DOCUMENTATION/`:

```text
DOCUMENTATION/
├── architecture/
│   ├── backend.md               # Node.js 20 ESM, wrapHandler, services, Pino, 5-min academic session cache
│   ├── database.md              # TiDB MySQL schema, Drizzle ORM, versioned migrations
│   ├── deployment.md            # Hostinger VPS, Nginx, Docker Compose, PM2
│   ├── frontend.md              # React 19 RSC, Tailwind 4, client state, optimistic UI
│   ├── storage.md               # Unified StorageProvider, Cloudinary CDN, local disk fallback
│   └── system-architecture.md   # Domain-driven architecture, system layers, events
├── authentication/
│   ├── authentication.md        # JWT jose auth, multi-role cookies, Session 205 raw cookie array buffering
│   ├── authorization.md         # RBAC matrix, route protection, role boundaries
│   └── session-management.md    # Active user_sessions table, SSE remote revocation, stale cookie purging
├── database/
│   ├── backup-strategy.md       # Automated DB dumps, point-in-time recovery
│   ├── migrations.md            # Safe 4-step Drizzle migration standard (0000-0011)
│   └── schema.md                # Identity, academic, registry, operations, finance, security schemas
├── deployment/
│   ├── nginx.md                 # Reverse proxy SSL termination, rate limiting, static asset caching
│   ├── render.md                # Cloud preview environment setup
│   ├── ssl.md                   # Let's Encrypt Certbot configuration
│   └── vps.md                   # Hostinger Ubuntu production VPS provisioning
├── development/
│   ├── ai-agent-guide.md        # AI agent mandates, verification checklist, definition of done
│   ├── coding-standards.md      # JS/TS style, React 19/Next.js 16 rules, Edge header buffering, Pino logging
│   ├── lessons-learned.md       # 11 Inviolable rules, defensive guardrails, post-mortem findings
│   ├── naming-conventions.md    # Storage keys, UUID randomization, roll number parsing, institutional keys
│   ├── project-conventions.md   # DDD domain service organization, folder layout, state scoping
│   └── ui-guidelines.md         # Tailwind CSS 4 theming, mobile drawers, WCAG 2.1 AA, 100vw layout prohibition
├── features/                    # Admission, attendance, certificates, exams, fees, notifications, reports
├── history/
│   ├── architectural-decisions.md # System ADRs (Hostinger VPS, DDD Drizzle, Storage Strategy, Smart Campus)
│   ├── migration-history.md     # Drizzle migrations (0000-0011), storage key updates, schema evolution
│   ├── old-cloudinary-migration.md # Cloudinary storage purge, pipeline rebuild, relative key invariant
│   └── resolved-incidents.md    # Forensic post-mortems (Session 205, 204, 203, 199, 196, 183, 176)
├── pages/                       # Admin, clerk, faculty, HOD, student UI pages specification
├── storage/                     # Cloudinary history, file storage, self-hosted storage, uploads
└── troubleshooting/             # Common errors, debugging guide, known issues
```

### Knowledge Base Quick Links:
- 🔐 [Authentication Architecture & Cookie Engine](./DOCUMENTATION/authentication/authentication.md)
- 🔑 [Session Management & Remote Revocation](./DOCUMENTATION/authentication/session-management.md)
- ⚙️ [Backend Architecture & Service Ecosystem](./DOCUMENTATION/architecture/backend.md)
- 📘 [Engineering Coding Standards](./DOCUMENTATION/development/coding-standards.md)
- 💡 [Comprehensive Lessons Learned & Guardrails](./DOCUMENTATION/development/lessons-learned.md)
- 🔍 [Chronological Forensics of Resolved Incidents](./DOCUMENTATION/history/resolved-incidents.md)
- 🤖 [AI Coding Agent Operating Blueprint](./DOCUMENTATION/development/ai-agent-guide.md)
- 🗄️ [Database & Infrastructure Migration Log](./DOCUMENTATION/history/migration-history.md)

---

## 3. Technical Stack Summary

| Subsystem | Primary Technology | Configuration & Details |
| :--- | :--- | :--- |
| **Framework** | Next.js 16 (App Router) | React 19, Server Components, Turbopack, `standalone` runner |
| **Styling** | Tailwind CSS 4 | Kakatiya Navy/Gold tokens, Mobile Section Drawers |
| **Database** | TiDB Cloud (MySQL 8.0) | Drizzle ORM, Modular DDD schemas in `src/db/schema/` |
| **Authentication** | JWT (HTTP-only) | `jose` JWTs, unified `setCookie` helpers, raw `newCookiesToSet` array buffering |
| **Real-Time** | Supabase Broadcast & Redis | Supabase Realtime channels (`room:pulse`), `ioredis` pub/sub |
| **Storage** | Strategy Pattern Provider | Cloudinary, Local Disk (`/var/www/kucet-storage`), S3/R2 |
| **Logging** | Pino Logger | Structured JSON logging via `@/lib/logger` (no bare `console.log`) |
| **Validation** | Zod & `wrapHandler` | Zero-trust input validation on all API endpoints |
| **Testing** | Vitest & Playwright | 39 test files (294 unit tests), E2E test suites |
| **Infrastructure** | Docker Compose & Nginx | Hostinger VPS, Tailscale mesh network, PM2 runner |

---

## 4. Repository Directory Map

```text
CMS/
├── DEPLOYMENT_PACKAGE/        # Production deployment scripts, Docker Compose, Nginx configs
├── DOCUMENTATION/             # System documentation knowledge base (see Master Index above)
├── drizzle/                   # Drizzle Kit migration SQL scripts (0000_... to 0011_...)
├── public/                    # Static public web assets (favicon, manifest)
├── scripts/                   # System automation, load testing, & storage migration scripts
├── src/
│   ├── app/                   # Next.js App Router (Pages, Layouts, API Routes)
│   │   ├── admin/             # Super Admin console
│   │   ├── api/               # Server API routes (/api/admin/*, /api/clerk/*, /api/student/*)
│   │   ├── clerk/             # Clerk & HOD console
│   │   └── student/           # Student portal
│   ├── components/            # React UI components grouped by domain/role
│   ├── db/                    # Drizzle ORM modular database schemas & client
│   ├── hooks/                 # Custom React hooks (useSecurityEvents, etc.)
│   ├── lib/                   # Utility libraries, clock, security, assets, storage config
│   ├── providers/             # Strategy providers (Storage, Email, Realtime)
│   └── services/              # Domain-Driven Service layer (identity, academic, finance, archive, security)
└── tests/                     # Vitest unit tests & Playwright E2E suites
```

---

## 5. System Core Capabilities

1. **Departmental Management & HOD Console:** Semester-aware timetable matrix (S1-S8), faculty workload tracker, condonation risk analytics (75% threshold).
2. **Proxy-Free Attendance Intelligence:** 50m Haversine GPS geofencing, dynamic 4-digit PINs, IP + User-Agent device lock.
3. **Real-Time Activity Pulse:** Instant schedule update synchronization across student and faculty dashboards via Supabase Broadcast.
4. **Digital Certificate Engine:** Server-side PDF generation via `@react-pdf/renderer` with HMAC-SHA256 digital signing and instant QR verification.
5. **Academic Archival & Restoration Engine:** Long-term archival of closed semesters and graduated students into `archive_*` tables with safe 1-click restoration.
6. **Financial Oversight & Integrity:** Government scholarship sanction tracking, fee ledger auditing, SHA-256 payment screenshot fingerprinting, idempotency key guards.
7. **Autonomous Deployment Infrastructure:** Docker Compose packaging on Hostinger VPS, automated health monitoring (`health-check.sh`), auto-rollback (`rollback.sh`), systemd runner service.

---

## 6. Inviolable Security & Architectural Invariants

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│                      INVIOLABLE SYSTEM INVARIANTS                             │
├───────────────────────────────────────────────────────────────────────────────┤
│ 1. NEVER use `npm run db:push` (Always use db:generate -> audit -> db:migrate)│
│ 2. NEVER use roll numbers or PII as filenames (Use crypto.randomUUID())       │
│ 3. DB storage keys MUST be relative (e.g., kucet/requests/pfp/7a59662b.webp)  │
│ 4. ALWAYS wrap client image sources with `getAssetUrl(key)`                    │
│ 5. NEVER attach HTML DOM props (onError, onClick) to @react-pdf components     │
│ 6. ALWAYS validate API inputs using Zod schemas inside `wrapHandler`           │
│ 7. Use Pino logger (@/lib/logger) — bare `console.log` is prohibited          │
│ 8. Buffer multi-cookie headers in Edge proxy using raw `newCookiesToSet` array │
│ 9. High-frequency DB helpers (getCurrentCalendarSession) MUST use 5-min cache │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Session 205 Historical Development & Commit Breakdown

Session 205 resolved critical cookie persistence bugs, hardened authentication boundaries, introduced high-performance academic session caching, and standardized explicit logout expiration.

| Commit Hash | Topic / Area | Key Engineering Changes |
| :--- | :--- | :--- |
| `3aec92cd1b596ac117dda1150a776cf0ef0fe8e8` | Auth Proxy Cookie Investigation (Part 1) | Updated missing access token silent refresh condition `(!adminAuth || adminRes.expired)` in `src/proxy.js` so missing tokens trigger silent refresh when companion session cookies exist. |
| `096f1f28370170b79296a7449d1751a7972a3c03` | Cloudinary & Storage Rebuild | Merged Cloudinary storage pipeline reset script (`scripts/reset-image-pipeline.mjs`), `src/lib/storage-config.js`, migration snapshot `0011_snapshot.json`, and PDF template non-DOM prop cleanups. |
| `827492fc6bf474fa1ac524d97f0fb28d16a18f28` | Explicit Logout & Cookie Purging (Part 2) | Refactored logout handlers (`/api/admin/logout`, `/api/auth/logout`, `/api/clerk/logout`, `/api/student/logout`) to delete all companion cookies explicitly; added `withCookies()` redirect header forwarding in proxy; added `sql\`${refreshTokens.revoked_at} IS NULL\`` condition during token reuse revocation. |
| `0440a5d9ebb935c853b65b6e08179f22029a7b1e` | Super Admin Login & Role Isolation | Fixed Super Admin login redirect bug; implemented multi-role cookie purging upon login in `src/lib/auth-utils.js`; payload-based routing in `LoginPanel.js`; created unit test suite `tests/unit/api/auth/admin-login.test.js`. |
| `24f342f91edc9f1aafb02b2fb9abc80c494dd683` | Academic Session Cache & Header Parsing (Part 3) | Added 5-minute process-level in-memory caching (`CACHE_TTL = 300,000ms`) to `getCurrentCalendarSession()` in `src/lib/academic-utils.js` reducing database load; initial header getter update in `proxy.js`. |
| `87853573a291822bde06c964cdc39aa683a8bdf8` | Final Cookie Persistence Fix (Part 4) | Final resolution of "Cookies Remain But App Shows Home Screen" by implementing raw `newCookiesToSet` string array invariant in `src/proxy.js`, bypassing Next.js header getter comma-merging bugs and attaching explicit HTTP 1970 expiration headers on logout/purge. |
| `5ef50d98f0ae1d3490543dc1914ccd429a62ba33` | Session Restoration & Manual Login Exclusivity | Replaced manual `Headers.append` with unified `setCookie` leveraging Next.js `response.cookies.set()` to fix comma-merging, changed `SameSite` to `Lax` for refresh tokens preventing cross-site redirect blocks, completely removed Google Sign-In & `next-auth` for institutional manual exclusivity, and updated unit tests mocks. |
| `bcf734f` | Clerk Self-Registration & Cloudinary Email Assets Fix | Created `ClerkRegistrationService`, pending request approval workflow, mandatory first-login password change, `PendingClerkRequests` admin component, and enforced Cloudinary-hosted branding assets for all email templates. |
| `6794da2` | Staff Registration Workflow Simplification | Restricted self-registration to 3 staff categories (Faculty, Scholarship Clerk, Admission Clerk), enforced branch selection for Faculty, deprecated free-text designation inputs, created `staff-config.js`. |
| `b45d87a` | Role-Isolated Admin Staff Management | Redesigned Admin Staff Management console (`/admin/manage-clerks`) into 3 distinct sections (Faculty, Scholarship, Admission) with tab-scoped pending requests, stats, and search. |
| `7bfafe6` | Faculty Branch Association & HOD Invariant | Added branch association, HOD promotion/demotion actions, and single-HOD-per-branch invariant validation. Created migration `0012_clerk_registration_requests.sql`. |
| `207c91f` | Staff Hierarchy & Onboarding Documentation | Created `DOCUMENTATION/features/staff-management.md` and updated `DOCUMENTATION/authentication/authentication.md` for staff onboarding workflows. |
| `ed1e334` | RBAC Role Alias Alignment | Aligned role resolution in `src/lib/rbac.js` so `scholarship` and `admission` roles resolve identically to `scholarship_clerk` and `admission_clerk`. |
| `7675ab3` | Dedicated Public Staff Onboarding Portal | Created dedicated public onboarding page at `/register/staff` with a 4-step workflow roadmap and link from `LoginPanel.js`. |
| `7375d99` | Storage Explorer Repair | Resolved tree hierarchy display by updating Cloudinary search expression to `public_id:kucet* OR folder:kucet*` and adding recursive subfolder discovery. |
| `29fcb9a` | Cloudinary URL Resolution | Implemented environment-aware Cloudinary CDN URL generation in `getAssetUrl()` and HTTP 307 redirect fallback in proxy route. |
| `699d376` | Client-Side Image Caching Layer | Added in-memory client image cache in `getAssetUrl()` and `AssetContext.js` with selective invalidation (`invalidateAssetCache`), zero duplicate network requests, and 100% storage-provider independence. |

---

## 8. Cloudinary Storage Pipeline & Client Caching Architecture

### 🔄 End-to-End Image Retrieval & Rendering Flow

```text
Database Column (Relative Key)
       │ e.g. "kucet/clerks/pfp/86421a61249948f3b14a0eb834ad078d.png"
       ▼
getAssetUrl(path) Transformer & Client Cache
       │
       ├─► 1. Check In-Memory Client Cache (CLIENT_ASSET_CACHE)
       │      ├─► HIT  ──► Return cached CDN URL immediately (0ms recalculation)
       │      └─► MISS ──► Generate URL & store in cache memory map
       │
       ├─► 2. Environment Resolution
       │      ├─► STORAGE_TYPE=cloudinary ──► "https://res.cloudinary.com/djs0ry74r/image/upload/f_auto,q_auto/kucet/..."
       │      └─► STORAGE_TYPE=local      ──► "/api/assets/view/kucet/..."
       │
       ▼
React Component Rendering (<Image src={getAssetUrl(path)} />)
       │
       ▼
Browser CDN Delivery (HTTP 200 OK from Cloudinary Edge Servers)
```

### 🎯 Lessons Learned & Permanent Storage Guardrails

1. **Single Source of Truth**: NEVER duplicate image URL helper functions (`buildImageUrl`, `imageUrl`, etc.). `getAssetUrl()` in `@/lib/assets` is the single canonical source of truth for converting storage keys to browser-ready URLs.
2. **Canonical Relative Keys**: NEVER store full URLs, bucket endpoints, or Cloudinary version strings in the database. DB columns store only clean relative keys (`kucet/<folder>/<uuid>.<ext>`).
3. **Cryptographic Random UUIDs**: Every uploaded asset receives a random UUID filename (`crypto.randomUUID()`). Roll numbers, student names, and emails MUST NEVER be used as filenames.
4. **Selective Invalidation**: When an asset is updated or replaced, invoke `invalidateAssetCache(pathOrKey)` to purge ONLY that specific key from client memory, preserving the cache for all other UI components.
5. **Provider Agnostic Caching**: The client caching layer operates strictly on relative paths, ensuring 100% compatibility across Local, Cloudinary, AWS S3, and Cloudflare R2 storage modes.

---

## 8. Developer Quick Reference & Commands

### Development & Testing Commands:
```bash
# Start local development server
npm run dev

# Run full Vitest unit test suite (39 test files)
npm run test

# Run ESLint compliance check
npm run lint

# Production build compilation check
npm run build
```

### Database Migration Workflow:
```bash
# 1. Generate migration SQL after editing src/db/schema/*.js
npm run db:generate

# 2. Apply versioned migration safely
npm run db:migrate
```

---

## 9. Cross-References

For deep-dive technical descriptions, architectural decision rationale, or incident forensics, proceed directly to the target file in the [Master Documentation Index](#2-master-documentation-index-documentation).

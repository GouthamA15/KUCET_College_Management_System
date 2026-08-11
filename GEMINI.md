# KUCET College Management System - Technical Index & Core Architecture

**System Version:** Session 204 Production Release  
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
├── development/
│   ├── coding-standards.md      # JS/TS style, React 19/Next.js 16 rules, Pino logging, Zod validation
│   ├── project-conventions.md   # DDD domain service organization, folder layout, state scoping, API normalization
│   ├── ui-guidelines.md         # Tailwind CSS 4 theming, mobile drawers, WCAG 2.1 AA, 100vw layout prohibition
│   ├── naming-conventions.md    # Storage keys, UUID randomization, roll number parsing, institutional keys
│   ├── lessons-learned.md       # 10 Inviolable rules, defensive guardrails, post-mortem findings
│   └── ai-agent-guide.md        # AI agent mandates, verification checklist, definition of done
└── history/
    ├── migration-history.md     # Drizzle migrations (0000-0011), storage key updates, schema evolution
    ├── architectural-decisions.md # System ADRs (Hostinger VPS, DDD Drizzle, Storage Strategy, Smart Campus)
    ├── resolved-incidents.md    # Forensic post-mortems (Session 204, 203, 199, 196, 183, 176)
    └── old-cloudinary-migration.md # Cloudinary storage purge, pipeline rebuild, relative key invariant
```

### Knowledge Base Quick Links:
- 📘 [Engineering Coding Standards](./DOCUMENTATION/development/coding-standards.md)
- 📐 [Project Architecture & DDD Conventions](./DOCUMENTATION/development/project-conventions.md)
- 🎨 [UI Design System & Mobile Guidelines](./DOCUMENTATION/development/ui-guidelines.md)
- 🏷️ [Universal Naming & Storage Key Standards](./DOCUMENTATION/development/naming-conventions.md)
- 💡 [Comprehensive Lessons Learned & Guardrails](./DOCUMENTATION/development/lessons-learned.md)
- 🤖 [AI Coding Agent Operating Blueprint](./DOCUMENTATION/development/ai-agent-guide.md)
- 🗄️ [Database & Infrastructure Migration Log](./DOCUMENTATION/history/migration-history.md)
- 🏛️ [Architectural Decision Records (ADRs)](./DOCUMENTATION/history/architectural-decisions.md)
- 🔍 [Chronological Forensics of Resolved Incidents](./DOCUMENTATION/history/resolved-incidents.md)
- ☁️ [Historical Cloudinary Migration Record](./DOCUMENTATION/history/old-cloudinary-migration.md)

---

## 3. Technical Stack Summary

| Subsystem | Primary Technology | Configuration & Details |
| :--- | :--- | :--- |
| **Framework** | Next.js 16 (App Router) | React 19, Server Components, Turbopack, `standalone` runner |
| **Styling** | Tailwind CSS 4 | Kakatiya Navy/Gold tokens, Mobile Section Drawers |
| **Database** | TiDB Cloud (MySQL 8.0) | Drizzle ORM, Modular DDD schemas in `src/db/schema/` |
| **Authentication** | JWT (HTTP-only) & OAuth | `jose` JWTs, Google OAuth via `next-auth`, role cookie isolation |
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
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Developer Quick Reference & Commands

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

## 8. Cross-References

For deep-dive technical descriptions, architectural decision rationale, or incident forensics, proceed directly to the target file in the [Master Documentation Index](#2-master-documentation-index-documentation).

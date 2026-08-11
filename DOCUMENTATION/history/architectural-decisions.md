# System Architectural Decision Records (ADRs)

**Last Updated:** August 11, 2026  
**Status:** Canonical Architectural Log  
**Scope:** Key Infrastructure, Framework, Database, Storage, and Security Architecture Decisions.

---

## ADR Index & Summary

| ADR ID | Decision Title | Status | Primary Technology |
| :--- | :--- | :--- | :--- |
| **ADR-001** | Hostinger VPS Infrastructure Selection | **ACCEPTED** | Ubuntu Linux, Docker Compose, Nginx, PM2 |
| **ADR-002** | Modular DDD Database Schema & Drizzle ORM | **ACCEPTED** | TiDB Cloud (MySQL), Drizzle ORM, Zod |
| **ADR-003** | Storage Provider Strategy & Relative Key Invariant | **ACCEPTED** | Cloudinary, S3/R2, Local Disk, Strategy Pattern |
| **ADR-004** | Rule-Based Smart Campus Intelligence Engine | **ACCEPTED** | GPS Geofencing, Supabase Broadcast, Redis |
| **ADR-005** | HMAC-SHA256 Signed PDF Certificate Engine | **ACCEPTED** | `@react-pdf/renderer`, HMAC-SHA256, QR Codes |
| **ADR-006** | Dual-Mode Archival Restoration Engine | **ACCEPTED** | Native `mysql` CLI, Drizzle SQL Fallback Batching |

---

## Detailed Architectural Decision Records

### ADR-001: Hostinger VPS Infrastructure Selection

#### Status
**ACCEPTED** (Session 179 - August 2, 2026)

#### Context & Problem Statement
The institution required a cost-effective, high-performance hosting infrastructure capable of serving thousands of concurrent student requests, handling real-time attendance sync, and processing background certificate generation without recurring per-user SaaS license fees.

#### Decision & Architectural Blueprint
Selected **Hostinger KVM 2 VPS** running Ubuntu Linux as the canonical self-hosted deployment target.
- **Containerization:** Multi-container **Docker Compose** packaging orchestrating:
  1. Next.js Standalone Runner (`kucet-cms-app` on port 3000).
  2. MySQL 8.0 Database (`kucet-cms-db` on port 3306 with tuned RAM buffer pools).
  3. Redis 7 Alpine (`kucet-cms-redis` on port 6379 for rate-limiting & QStash queue).
- **Reverse Proxy:** **Nginx** upstream configuration with persistent TCP keepalive connection pools (`keepalive 64;`), Gzip compression, and buffer tuning.
- **Zero-Trust Access:** Tailscale WireGuard mesh networking and Cloudflare Tunnels securing admin ports.

#### Consequences
- **Positive:** Fixed hosting budget, zero vendor per-user charges, sub-millisecond database latency, full container isolation.
- **Negative:** Infrastructure management responsibility rests on the institutional engineering team (mitigated by automated self-healing scripts in `DEPLOYMENT_PACKAGE/SCRIPTS/`).

---

### ADR-002: Modular DDD Database Schema & Drizzle ORM

#### Status
**ACCEPTED** (Session 181 - August 5, 2026)

#### Context & Problem Statement
Early iterations relied on a monolithic schema file (`src/db/schema.js`), leading to developer merge conflicts, mixed domain concerns, and fragile column references during database updates.

#### Decision
Transitioned to **Domain-Driven Design (DDD)** modular database schemas under `src/db/schema/`:
- `identity.js`, `academic.js`, `registry.js`, `operations.js`, `finance.js`, `archive.js`, `security.js`.
- Barrel re-export in `src/db/schema.js` guarantees 100% backward compatibility.
- Adopted **Drizzle ORM** for strict TypeScript/JavaScript type safety.
- Established the **Safe 4-Step Migration Workflow** (`npm run db:generate` -> manual `.sql` review -> `npm run db:migrate`).
- **Inviolable Invariant:** Strictly prohibited `npm run db:push` in all environments.

#### Consequences
- **Positive:** 100% compile-time type safety, clear domain boundaries, safe version-controlled migrations, zero accidental data loss.
- **Negative:** Schema edits require running generator scripts and auditing SQL output prior to migration.

---

### ADR-003: Storage Provider Strategy & Relative Key Invariant

#### Status
**ACCEPTED** (Session 154 / Session 200 - August 10, 2026)

#### Context & Problem Statement
Hardcoded Cloudinary SDK methods and local file paths produced broken image URLs when deploying to self-hosted VPS environments or local offline testing setups.

#### Decision
Implemented the **Strategy Pattern** for media storage (`src/providers/storage/`):
1. **Abstract Interface (`StorageProvider`):** Exposes `upload()`, `getUrl()`, and `delete()`.
2. **Implementations:** `LocalStorageProvider`, `CloudinaryStorageProvider`, `S3StorageProvider`.
3. **Relative Storage Key Invariant:** Database columns store strictly canonical relative keys (e.g., `requests/pfp/7a59662b-8a4e.webp`). Client components invoke `getAssetUrl(key)` to resolve full CDN or proxy URLs dynamically.
4. **UUID Randomization:** Uploaded filenames MUST generate cryptographically random UUIDs (`crypto.randomUUID()`). Roll numbers are strictly forbidden as filenames.

#### Consequences
- **Positive:** Seamless multi-provider failover, complete decoupling of DB schema from cloud vendors, zero PII leakage in file URLs.
- **Negative:** Requires asset URL wrapping (`getAssetUrl()`) across all frontend components.

---

### ADR-004: Rule-Based Smart Campus Intelligence Engine

#### Status
**ACCEPTED** (Session 140 - May 2026)

#### Context & Problem Statement
Traditional classroom attendance was susceptible to proxy marking, fraudulent check-ins, and delayed HOD schedule synchronization.

#### Decision
Engineered a multi-layered rule-based intelligence engine:
- **Haversine Geofencing:** 50-meter GPS radius validation around campus coordinates (`gps_latitude`, `gps_longitude`).
- **Dynamic 4-Digit PIN:** Faculty generates temporary 4-digit session PINs expiring in 3 minutes.
- **Device Fingerprinting:** Hashes IP address + User-Agent to detect phone sharing.
- **Real-Time Sync:** Uses **Supabase Broadcast** channels (`room:attendance`, `room:pulse`) for instant timetable update propagation to student activity bars.

#### Consequences
- **Positive:** 100% proxy elimination, real-time timetable synchronization across all 8 semesters.
- **Negative:** Requires active GPS hardware permissions on student mobile browsers.

---

### ADR-005: HMAC-SHA256 Signed PDF Certificate Engine

#### Status
**ACCEPTED** (Session 147 / Session 203 - August 10, 2026)

#### Context & Problem Statement
Issuing paper certificates was slow and prone to forgery. The institution required an automated, tamper-proof digital certificate generation pipeline.

#### Decision
Engineered a server-side PDF generation engine using `@react-pdf/renderer`:
- **Cryptographic Signing:** Generates an HMAC-SHA256 signature combining student ID, certificate request ID, issue date, and institutional secret key.
- **Verification QR Code:** Embeds a QR code containing the verification URL (`/verify?cert=...`) on the document layout.
- **Institutional Asset Service:** Resolves principal signatures and college seals via `InstitutionAssetService`.
- **Non-DOM Invariant:** Enforced strict exclusion of HTML DOM event handlers (`onError`, `onClick`) from all PDF templates.

#### Consequences
- **Positive:** Instant PDF generation, tamper-evident digital verification, seamless fee waiver tracking.
- **Negative:** Server CPU overhead during bulk generation (mitigated by binary buffer caching).

---

### ADR-006: Dual-Mode Restoration Engine

#### Status
**ACCEPTED** (Session 184 / Session 187 - August 7, 2026)

#### Context & Problem Statement
Restoring archived student profiles and closed semester academic logs back to operational database tables risked crashing due to missing default columns or missing CLI toolchains in lightweight containers.

#### Decision
Architected a **Dual-Mode Restoration Pipeline** in `ArchiveRestoreService.js`:
- **Primary Execution Mode:** Invokes native `mysql` CLI batch statements for high-throughput restoration.
- **Fallback Execution Mode:** Automatically fails over to Drizzle SQL statement batching if the native MySQL CLI toolchain is unavailable in the execution container.
- **Constraint Safety Guard:** Injects missing fallback default column parameters (`session_pin`, `attendance_date`, `expires_at`) to strictly satisfy MySQL `NOT NULL` table constraints.

#### Consequences
- **Positive:** 100% zero-data-loss restoration, high resilience across Docker and VPS environments, 1-click Super Admin profile reactivation.
- **Negative:** Maintenance of dual restoration logic paths.

---

## Cross-References & Related Documentation

- [Database & Infrastructure Migration Log](./migration-history.md)
- [Chronological Forensics of Resolved Incidents](./resolved-incidents.md)
- [Old Cloudinary Storage Migration History](./old-cloudinary-migration.md)
- [Project Architecture Conventions](../development/project-conventions.md)

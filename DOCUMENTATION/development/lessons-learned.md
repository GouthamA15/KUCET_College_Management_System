# KUCET CMS - Comprehensive Project Lessons Learned

**Last Updated:** August 11, 2026  
**Status:** Mandatory Engineering Reference  
**Scope:** Architectural Post-Mortems, Production Lessons, and Defensive Guardrails.

---

## 1. Overview & Architectural Retrospective

Over the course of 205 development sessions, the KUCET College Management System evolved from a standard web app into an enterprise-grade academic platform. Along the way, critical bugs, security traps, deployment failures, and storage refactorings produced invaluable architectural insights.

This document synthesizes those key lessons into **11 Inviolable Rules** and defensive guardrails to prevent regressions.

---

## 2. Eleven Inviolable Rules & Defensive Guardrails

### Rule 1: Never Store Roll Numbers as Filenames
- **The Pitfall:** Saving images as `24KUEC001.jpg` leaks PII, enables malicious file enumeration, and causes stale browser caching when a student updates their picture.
- **The Inviolable Guardrail:** ALWAYS generate cryptographically random UUIDs (`crypto.randomUUID()`) for file storage keys (`requests/pfp/7a59662b-8a4e.webp`).

### Rule 2: Randomize Uploaded Filenames
- **The Pitfall:** Relying on user-provided original filenames (`my_photo.jpg`) leads to directory collisions, unsafe character injection, and unhandled file overwrite bugs.
- **The Inviolable Guardrail:** Strip original filenames on upload and enforce UUID v4 naming prior to persistence.

### Rule 3: Never Hardcode Asset Paths
- **The Pitfall:** Hardcoding `/public/uploads/` or `https://res.cloudinary.com/...` across API routes breaks when switching environments (e.g., local VPS vs Cloudinary).
- **The Inviolable Guardrail:** ALWAYS use centralized storage folder constants from `src/lib/storage-config.js` and generate URLs using `getAssetUrl()`.

### Rule 4: Never Mix Storage Providers
- **The Pitfall:** Calling Cloudinary SDK methods directly inside API handlers created tight coupling, making local disk deployment impossible.
- **The Inviolable Guardrail:** Direct SDK imports in API routes are prohibited. All media uploads, deletes, and URL resolutions must route through the unified `StorageProvider` strategy interface.

### Rule 5: Always Use the `StorageProvider` Abstraction
- **The Pitfall:** Custom file handling per route introduced inconsistent permission checks and missing directory creation errors.
- **The Inviolable Guardrail:** Use `storage.upload()`, `storage.getUrl()`, and `storage.delete()` from `@/providers/storage`.

### Rule 6: Never Bypass `getAssetUrl()` on Client Components
- **The Pitfall:** Passing raw relative keys directly to `<img src={student.pfp}>` tags causes client browsers to request `https://domain.com/requests/pfp/abc.webp`, resulting in HTTP 404 errors.
- **The Inviolable Guardrail:** Wrap all client image source parameters with `getAssetUrl(student.pfp)`.

### Rule 7: Keep Uploads Outside Frontend Source
- **The Pitfall:** Writing uploads into the Next.js `public/` directory during runtime triggers Turbopack build invalidations and loses files on ephemeral container redeploys.
- **The Inviolable Guardrail:** Store assets strictly in persistent external storage volumes (`/var/www/kucet-storage/public`) or Cloudinary.

### Rule 8: Never Expose Server Filesystem Paths to Clients
- **The Pitfall:** Returning full server paths (`C:\Users\...` or `/app/public/uploads/...`) in JSON payloads exposes server architecture to attackers.
- **The Inviolable Guardrail:** Sanitize all asset paths to relative keys before sending API responses.

### Rule 9: Separate Production and Development Configurations
- **The Pitfall:** Using production database credentials or storage buckets during local development risks accidental data deletion.
- **The Inviolable Guardrail:** Enforce strict environment isolation using `.env.local` vs `.env.production`.

### Rule 10: Preserve Backwards Compatibility
- **The Pitfall:** Deleting legacy service functions or database columns broke existing API endpoints and frontend widgets during incremental rollouts.
- **The Inviolable Guardrail:** Use barrel re-exports (`src/services/index.js`, `src/db/schema.js`) and snake_case schema aliases to ensure zero broken imports.

### Rule 11: Never Rely on `Headers.getSetCookie()` or Comma-Joined Headers for Multi-Cookie Responses in Next.js Middleware
- **The Pitfall:** In Next.js middleware (Edge runtime), using `response.headers.forEach()` or standard Web `Headers` methods can merge multiple `Set-Cookie` headers into a single comma-separated string (`Set-Cookie: cookieA=valA; Path=/, cookieB=valB; Path=/`). Modern browsers reject or misparse comma-joined `Set-Cookie` headers, leading to silent authentication drops where session cookies persist in browser storage while auth tokens fail to save.
- **The Inviolable Guardrail:** ALWAYS maintain an explicit raw JavaScript array (`let newCookiesToSet = []`) when buffering multi-cookie mutations in Next.js Edge middleware (`src/proxy.js`). Append headers explicitly via `response.headers.append('set-cookie', cookieStr)` from the raw array rather than relying on `Headers` getters or header iteration functions.

---

## 3. Database Migration Safety Lessons

> [!CAUTION]
> **LESSON LEARNED: `npm run db:push` CAUSES DATA LOSS!**  
> In early development, running `db:push` automatically dropped non-matching columns during schema refactoring.

### The Standardized Fix:
- **Never use `db:push`.**
- Always follow the versioned migration workflow: `src/db/schema/` -> `npm run db:generate` -> manual `.sql` review -> `npm run db:migrate`.

---

## 4. Server-Side PDF Engine Safeguards

> [!IMPORTANT]
> **LESSON LEARNED: React-PDF Components are Non-DOM!**  
> In Session 203, certificate downloads broke because an `<Image>` component contained an HTML DOM event handler: `onError={(e) => { e.currentTarget.style.display = 'none'; }}`. Since `@react-pdf/renderer` executes on the server without a DOM `window` or `currentTarget`, it threw `TypeError: Cannot read properties of undefined (reading 'style')`.

### Safe Rendering Protocol:
- Remove ALL DOM event handlers (`onClick`, `onError`, `onLoad`) and HTML props (`alt`, `className`) from `@react-pdf` components.
- Validate binary magic numbers (`0xFF 0xD8` -> JPEG, `0x89 0x50` -> PNG) prior to passing buffers to React-PDF.

---

## 5. Security & Authentication Safeguards

- **User Enumeration Defense:** Auth routes (`/forgot-password`, `/login`) must return generic success messages (`"If an account exists..."`) regardless of whether an email or roll number exists in the database.
- **SHA-256 OTP Persistence:** Never persist plaintext OTPs in the database. Store SHA-256 hashes and compare using `crypto.timingSafeEqual()`.
- **Account Lockouts:** Combine IP-based rate limiting with per-account lockout keys (`login_acct:{id}`) to prevent distributed brute-force attacks.
- **Role Isolation Cookie Purging:** On authentication as any role, purge all companion cookies belonging to other roles (`clerk_*`, `student_*`, `admin_*`) to guarantee strict domain isolation.

---

## 6. Cross-References & Related Documentation

- [Engineering Coding Standards](./coding-standards.md)
- [Project Architecture Conventions](./project-conventions.md)
- [AI Coding Agent Blueprint & Guidelines](./ai-agent-guide.md)
- [Chronological Forensics of Resolved Incidents](../history/resolved-incidents.md#1-session-205-forensic-resolution-of-cookies-remain-but-app-shows-home-screen)

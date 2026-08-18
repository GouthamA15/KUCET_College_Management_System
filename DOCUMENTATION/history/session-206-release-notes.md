# Session 206 — Release Notes & Comprehensive Change Log

**Release Date:** August 16, 2026  
**Commits:** `2d8049c` (feat) · `d55c026` (docs)  
**Author:** P.Sannith  
**Status:** Merged to `main` via PR #91  
**Test Suite:** 4 new test files added — all passing

---

## Executive Summary

Session 206 is a **controlled hardening and infrastructure synchronization release**. It introduces no new database schema migrations but significantly strengthens the security posture of all asynchronous webhook endpoints, activates the previously stubbed Web Push notification delivery pipeline, integrates a production-grade Sentry error monitoring stack, provides a synchronous fallback path for bulk student imports on self-hosted deployments, connects domain event publishing to real API handlers, and completely restructures environment configuration files to match actual codebase usage.

---

## Table of Contents

1. [QStash Webhook Signature Verification Hardening](#1-qstash-webhook-signature-verification-hardening)
2. [Web Push Notification — Full VAPID Implementation](#2-web-push-notification--full-vapid-implementation)
3. [Service Worker Push & Click Handlers](#3-service-worker-push--click-handlers)
4. [Sentry Error Monitoring — Production Integration](#4-sentry-error-monitoring--production-integration)
5. [Bulk Student Import — Synchronous Fallback](#5-bulk-student-import--synchronous-fallback)
6. [EventBus Domain Event Publishing](#6-eventbus-domain-event-publishing)
7. [Queue URL Standardization](#7-queue-url-standardization)
8. [Environment Schema & Config Cleanup](#8-environment-schema--config-cleanup)
9. [New Test Coverage](#9-new-test-coverage)
10. [Package Dependency Updates](#10-package-dependency-updates)
11. [Documentation Updates](#11-documentation-updates)
12. [Files Changed — Complete Manifest](#12-files-changed--complete-manifest)
13. [No Database Schema Changes](#13-no-database-schema-changes)
14. [Deployment Checklist](#14-deployment-checklist)

---

## 1. QStash Webhook Signature Verification Hardening

### Problem
Previously, 4 out of 7 QStash webhook endpoints (`archive-job`, `generate-pdf`, `notification-dispatch`, `report-generation`) exported a raw `async function POST` with **no cryptographic signature verification**. This left these endpoints open to spoofing — any actor knowing the URL could trigger archive jobs, PDF generation, or push notification dispatches without any validation.

Additionally, the 3 endpoints that already had signature verification only checked for `QSTASH_TOKEN`, but a signing key (`QSTASH_CURRENT_SIGNING_KEY`) is separately required for `verifySignatureAppRouter` to function correctly.

### Solution
All **7 QStash webhook endpoints** now use the same conditional guard pattern:

```javascript
// BEFORE (vulnerable — no verification):
export async function POST(req) { ... }

// AFTER (hardened — conditional HMAC verification):
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";

async function handler(req) { ... }

export const POST = (process.env.QSTASH_TOKEN && process.env.QSTASH_CURRENT_SIGNING_KEY)
  ? verifySignatureAppRouter(handler)
  : handler;
```

The guard requires **both** `QSTASH_TOKEN` and `QSTASH_CURRENT_SIGNING_KEY` to be present to activate verification. When running locally without QStash credentials, endpoints still work as bare handlers — preserving developer ergonomics.

### Affected Endpoints

| Endpoint File | Before | After |
| :--- | :--- | :--- |
| `webhooks/qstash/archive-job/route.js` | No verification | `verifySignatureAppRouter` added |
| `webhooks/qstash/generate-pdf/route.js` | No verification | `verifySignatureAppRouter` added |
| `webhooks/qstash/notification-dispatch/route.js` | No verification | `verifySignatureAppRouter` added |
| `webhooks/qstash/report-generation/route.js` | No verification | `verifySignatureAppRouter` added |
| `webhooks/qstash/bulk-import/route.js` | Token-only guard | Token + signing key dual-guard |
| `webhooks/qstash/dlq/route.js` | Token-only guard | Token + signing key dual-guard |
| `webhooks/qstash/send-email/route.js` | Token-only guard | Token + signing key dual-guard |

> **Required env vars for production:** `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`

---

## 2. Web Push Notification — Full VAPID Implementation

### Problem
`PushNotificationService.sendToRecipients()` was a **stub placeholder** that returned `{ success: true, sentCount: recipients.length }` without actually querying the database, constructing payloads, or sending anything to any browser.

### Solution
The method is now a **complete, production-grade VAPID push notification dispatcher** using the `web-push` npm library (`^3.6.7`).

### New Implementation Flow

```
sendToRecipients(recipients, notification)
    |
    +-- 1. Validate VAPID keys (VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY)
    |       If missing: graceful early return { success: true, sentCount: 0, reason: 'VAPID not configured' }
    |
    +-- 2. Set VAPID details on web-push library
    |       Contact email: VAPID_CONTACT_EMAIL || EMAIL_USER || 'mailto:admin@kucet.ac.in'
    |
    +-- 3. Normalize recipient IDs (supports { userId, id, user_id } objects or plain strings)
    |
    +-- 4. Query pushSubscriptions table using inArray(pushSubscriptions.user_id, userIds)
    |       If no subscriptions found: early return { success: true, sentCount: 0 }
    |
    +-- 5. Construct JSON payload: { title, body, url, icon, data, category, timestamp }
    |
    +-- 6. Promise.all() — send to all subscriptions in parallel:
    |       Success: sentCount++
    |       HTTP 404 or 410: mark subscription as stale -> staleSubscriptionIds[]
    |       Other error: log warn, failedCount++
    |
    +-- 7. Cleanup: DELETE FROM pushSubscriptions WHERE id IN (staleSubscriptionIds)
            Returns: { success, sentCount, failedCount, staleCount }
```

### VAPID Environment Variables

```env
# Generate with: npx web-push generate-vapid-keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key   # Sent to browser on subscription
VAPID_PUBLIC_KEY=your_vapid_public_key               # Server-side usage
VAPID_PRIVATE_KEY=your_vapid_private_key             # Server-side only — NEVER expose
VAPID_CONTACT_EMAIL=mailto:admin@kucet.ac.in         # Fallback to EMAIL_USER
```

### Stale Subscription Cleanup
When a browser push service returns **HTTP 404** (endpoint not found) or **HTTP 410** (subscription has expired / user unsubscribed), the subscription record is **automatically deleted** from the `push_subscriptions` table. This keeps the subscription store clean without manual intervention.

---

## 3. Service Worker Push & Click Handlers

**File:** `public/sw.js`

Two new event listeners were added to the existing service worker:

### `push` Event — Receive & Display Notifications
```javascript
self.addEventListener('push', (event) => {
  // Parses JSON payload: { title, body, icon, url, data, category }
  // Falls back to raw text if JSON.parse fails
  // Calls self.registration.showNotification(title, options)
  // Supports tag-based deduplication and renotify:true for same-tag updates
});
```

### `notificationclick` Event — Handle User Interaction
```javascript
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // 1. Tries to focus an existing open client window
  // 2. Falls back to self.clients.openWindow(targetUrl) from notification data
});
```

---

## 4. Sentry Error Monitoring — Production Integration

### New Files Created

| File | Purpose |
| :--- | :--- |
| `src/instrumentation.js` | Next.js App Router instrumentation hook — registers Sentry for Node.js and Edge runtimes |
| `src/instrumentation-client.js` | Client-side Sentry init with Session Replay integration |
| `src/app/global-error.jsx` | React global error boundary — captures uncaught exceptions to Sentry |

### `src/instrumentation.js` — Server-Side Registration
```javascript
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}
export const onRequestError = Sentry.captureRequestError;
```

### `src/instrumentation-client.js` — Client SDK
```javascript
Sentry.init({
  dsn: "https://303f026...@o4511920318316544.ingest.us.sentry.io/4511920329785344",
  integrations: [Sentry.replayIntegration()],
  tracesSampleRate: 1,
  enableLogs: true,
  replaysSessionSampleRate: 0.1,   // 10% of all sessions recorded
  replaysOnErrorSampleRate: 1.0,   // 100% on error sessions recorded
});
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
```

### `src/app/global-error.jsx` — Error Boundary
```jsx
export default function GlobalError({ error }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);
  return (
    <html lang="en"><body><NextError statusCode={0} /></body></html>
  );
}
```

### Existing Sentry Config Files — Hardened

| File | Before | After |
| :--- | :--- | :--- |
| `sentry.client.config.js` | Always initialized with placeholder DSN | Conditional: only initializes when `NEXT_PUBLIC_SENTRY_DSN` is set |
| `sentry.edge.config.js` | Used placeholder DSN, no log support | Uses env DSN, added `enableLogs: true`, `dataCollection` config |
| `sentry.server.config.js` | Used placeholder DSN, no log support | Uses env DSN, added `enableLogs: true`, `dataCollection` config |

### `.gitignore` Addition
```
# Sentry Config File
.env.sentry-build-plugin
```

> **Note:** The DSN in `src/instrumentation-client.js` is currently hardcoded. For multi-environment deployments, this should be moved to `process.env.NEXT_PUBLIC_SENTRY_DSN`.

---

## 5. Bulk Student Import — Synchronous Fallback

**File:** `src/app/api/clerk/admission/bulk-import/route.js`

### Problem
The bulk import endpoint **always** tried to dispatch to QStash. If QStash was not configured or the dispatch failed, it returned a hard `500` error — making the feature unusable on self-hosted VPS deployments without Upstash cloud.

### Solution — Tiered Execution Strategy

```
POST /api/clerk/admission/bulk-import
    |
    +-- IF process.env.QSTASH_TOKEN is set:
    |     Chunk prepared records (50 per chunk)
    |     Queue.enqueueBulkImportChunk() for each chunk
    |     If ALL chunks queued successfully -> return 200 (background processing)
    |     If QStash fails -> fall through to synchronous path below
    |
    +-- SYNCHRONOUS FALLBACK (no QStash / QStash enqueue failed):
          Detect existing students by roll_no (inArray query)
          Detect email collisions with existing students
          db.transaction() — process all records:
            - Check for duplicate emails WITHIN the import batch
            - Check for email collision WITH existing database records
            - StudentService.upsertStudent(record, clerkId, tx)
            - Track inserted vs updated counts
          Insert studentImportLogs on success
          Return: { inserted, updated, skipped, errors, totalRows }
```

### Import Fixes
Several broken imports were corrected (stale naming from a previous refactor):

| Before (broken) | After (correct) |
| :--- | :--- |
| `import { _db }` | `import { db }` |
| `import { students as _studentsTable }` | `import { students as studentsTable }` |
| `import { _eq, _inArray }` | `import { inArray }` |
| `import { _StudentService }` | `import { StudentService }` |
| `import { _studentPersonalDetails, _studentAcademicBackground, _studentImportLogs }` | `import { studentImportLogs }` |

---

## 6. EventBus Domain Event Publishing

The `EventBus` domain event system was previously wired up but **not actually called** from real API handlers. Session 206 connects two critical real-world events:

### Attendance Submission → `ATTENDANCE_SUBMITTED`
**File:** `src/app/api/clerk/faculty/attendance/route.js`

```javascript
// After successfully updating attendance records:
const { EventBus, DOMAIN_EVENTS } = await import('@/lib/events/EventBus');
for (const item of attendance_data) {
  EventBus.publish(DOMAIN_EVENTS.ATTENDANCE_SUBMITTED, {
    student_id: item.student_id,
    assignment_id: targetAssignmentId,
    date,
    session
  });
}
```

### Scholarship Payment → `FEE_PAID`
**File:** `src/app/api/clerk/scholarship/payments/route.js`

```javascript
// After successfully recording a payment:
const { EventBus, DOMAIN_EVENTS } = await import('@/lib/events/EventBus');
EventBus.publish(DOMAIN_EVENTS.FEE_PAID, {
  student_id: student.id,
  roll_no: student.roll_no,
  amount,
  academic_year
});
```

Both calls are wrapped in `try/catch` — EventBus failures log a warning but **never block the HTTP response**. Dynamic imports (`await import(...)`) prevent circular dependency issues at module load time.

---

## 7. Queue URL Standardization

**File:** `src/lib/queue.js`

### Changes
1. **Primary env var changed**: `NEXT_PUBLIC_APP_URL` → `NEXT_PUBLIC_BASE_URL` (with `NEXT_PUBLIC_APP_URL` as fallback for backwards compatibility)
2. **Trailing slash stripping**: Prevents double-slash in webhook URLs when `BASE_URL` has a trailing `/`
3. **Endpoint path normalization**: Ensures endpoint paths always start with `/`
4. **Logger upgrade**: Replaced `console.warn` with `logger.warn` (Pino — per coding standards)

```javascript
// BEFORE:
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const url = `${baseUrl}${endpoint}`;
console.warn('QSTASH_TOKEN not found...');

// AFTER:
const rawBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const baseUrl = rawBaseUrl.replace(/\/+$/, '');
const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
logger.warn({ url }, 'QSTASH_TOKEN not found, skipping background job dispatch');
```

---

## 8. Environment Schema & Config Cleanup

### `src/lib/env.js` — Schema Changes

| Field | Before | After | Reason |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` valid values | `development`, `testing`, `production` | + `test` added | Vitest sets `NODE_ENV=test` |
| `NODE_ENV` default | `development` | `production` | Fail-safe production default |
| `GOOGLE_CLIENT_ID` | Required string | **Removed** | Google OAuth fully removed in Session 205 |
| `GOOGLE_CLIENT_SECRET` | Required string | **Removed** | Google OAuth fully removed in Session 205 |

### `.env.example` — Complete Restructure
The file was reorganized from a flat unordered list into **12 clearly labeled sections**:

```
Section 1:  Environment & Runtime
Section 2:  Database Configuration (TiDB / MySQL)
Section 3:  Authentication & Security (JWT, Certificate, Encryption)
Section 4:  Canonical Application URL
Section 5:  Transactional Email (Brevo API)
Section 6:  Storage Provider Strategy (Cloudinary / Local / S3 / R2)
Section 7:  Asynchronous Queue & Webhooks (Upstash QStash) — optional
Section 8:  Distributed Cache & Rate Limiting (Upstash Redis) — optional
Section 9:  Real-Time Activity Pulse (Redis + Supabase)
Section 10: Error Monitoring (Sentry DSN) — optional
Section 11: Web Push Notifications (VAPID keys) — optional
Section 12: Institutional Static Assets & Configuration
```

**Removed variables (no longer needed):**
- `NEXTAUTH_URL` — `next-auth` removed in Session 205
- `GOOGLE_CLIENT_ID` — Google OAuth removed
- `GOOGLE_CLIENT_SECRET` — Google OAuth removed

**New variables documented:**
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_CONTACT_EMAIL`
- `NEXT_PUBLIC_SENTRY_DSN`
- `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY` (both required for webhook verification)
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`

> All optional/cloud services are now **commented out by default** in `.env.example`, making the system fully operational on a self-hosted VPS without any external cloud dependencies.

### `DEPLOYMENT_PACKAGE/.env.production.template`
Mirrored all the same changes as `.env.example` to keep the production deployment template in sync.

---

## 9. New Test Coverage

4 new test files added, bringing total coverage to **44 test files**.

### `tests/unit/api/bulk-import-fallback.test.js`
- Verifies the `POST` handler is exported and callable when `QSTASH_TOKEN` is absent
- Ensures synchronous fallback path doesn't crash on import

### `tests/unit/lib/queue-url.test.js`
Tests 3 scenarios for `enqueueJob()`:
1. Uses `NEXT_PUBLIC_BASE_URL` when present
2. Strips trailing slashes to prevent double-slash in webhook URLs
3. Returns `null` when `QSTASH_TOKEN` is absent

### `tests/unit/webhooks/qstash-webhooks-security.test.js`
Tests 5 scenarios for webhook signature verification:
1. `archive-job` route wraps with `verifySignatureAppRouter` when keys are set
2. `notification-dispatch` route wraps when keys are set
3. `generate-pdf` route wraps when keys are set
4. `report-generation` route wraps when keys are set
5. Falls back to raw handler when QStash credentials are absent

### `tests/unit/services/PushNotificationService.test.js` (updated)
- Added test: gracefully handles `sendToRecipients` when VAPID keys are not configured
- Verifies `{ success: true, sentCount: 0, reason: 'VAPID...' }` response

---

## 10. Package Dependency Updates

| Package | Before | After | Reason |
| :--- | :--- | :--- | :--- |
| `@sentry/nextjs` | `^10.43.0` | `^10.70.0` | Required for App Router instrumentation hooks |
| `web-push` | Not installed | `^3.6.7` | W3C Web Push API / VAPID notification delivery |

---

## 11. Documentation Updates

Commit `d55c026` updated 4 documentation files:

| File | Lines Added | Topic |
| :--- | :---: | :--- |
| `DOCUMENTATION/architecture/backend.md` | +27 | EventBus publishing from real handlers, QStash dual-key hardening |
| `DOCUMENTATION/development/lessons-learned.md` | +29 | Rule 12: Always require both QSTASH_TOKEN and signing key for verification |
| `DOCUMENTATION/features/notifications.md` | +71 | Full Web Push implementation docs (VAPID, sw.js handlers, stale cleanup) |
| `DOCUMENTATION/history/migration-history.md` | +13 | Session 206 entry |

---

## 12. Files Changed — Complete Manifest

```
31 files changed | 1,224 insertions | 395 deletions
```

### Modified Files

| File | Category | Change Description |
| :--- | :--- | :--- |
| `.env.example` | Config | Complete restructure into 12 labeled sections |
| `.gitignore` | Config | Added `.env.sentry-build-plugin` |
| `DEPLOYMENT_PACKAGE/.env.production.template` | Config | Synchronized with `.env.example` structure |
| `GEMINI.md` | Docs | Session 206 entry added |
| `next.config.mjs` | Config | Minor cleanup / reformatting (no functional change) |
| `package.json` | Deps | `@sentry/nextjs` upgraded; `web-push` added |
| `package-lock.json` | Deps | Lockfile updated for new packages |
| `public/sw.js` | Frontend | Added `push` and `notificationclick` event listeners |
| `sentry.client.config.js` | Observability | Conditional initialization on DSN env var |
| `sentry.edge.config.js` | Observability | Removed placeholder DSN; added `enableLogs`, `dataCollection` |
| `sentry.server.config.js` | Observability | Removed placeholder DSN; added `enableLogs`, `dataCollection` |
| `src/app/api/clerk/admission/bulk-import/route.js` | API | Synchronous fallback + broken import fixes |
| `src/app/api/clerk/faculty/attendance/route.js` | API | EventBus `ATTENDANCE_SUBMITTED` publish |
| `src/app/api/clerk/scholarship/payments/route.js` | API | EventBus `FEE_PAID` publish |
| `src/app/api/webhooks/qstash/archive-job/route.js` | Security | Added `verifySignatureAppRouter` wrapping |
| `src/app/api/webhooks/qstash/bulk-import/route.js` | Security | Strengthened to dual-key guard |
| `src/app/api/webhooks/qstash/dlq/route.js` | Security | Strengthened to dual-key guard |
| `src/app/api/webhooks/qstash/generate-pdf/route.js` | Security | Added `verifySignatureAppRouter` wrapping |
| `src/app/api/webhooks/qstash/notification-dispatch/route.js` | Security | Added `verifySignatureAppRouter` wrapping |
| `src/app/api/webhooks/qstash/report-generation/route.js` | Security | Added `verifySignatureAppRouter` wrapping |
| `src/app/api/webhooks/qstash/send-email/route.js` | Security | Strengthened to dual-key guard |
| `src/lib/env.js` | Core | Removed Google OAuth vars; added `test` NODE_ENV; default to production |
| `src/lib/queue.js` | Core | Standardized `NEXT_PUBLIC_BASE_URL`; strip trailing slashes; Pino logging |
| `src/services/security/PushNotificationService.js` | Service | Full VAPID implementation replacing stub |

### New Files Created

| File | Category | Purpose |
| :--- | :--- | :--- |
| `src/app/global-error.jsx` | Frontend | React error boundary capturing exceptions to Sentry |
| `src/instrumentation.js` | Observability | Next.js App Router server-side Sentry registration |
| `src/instrumentation-client.js` | Observability | Client-side Sentry init with Session Replay |
| `tests/unit/api/bulk-import-fallback.test.js` | Tests | Bulk import synchronous fallback path coverage |
| `tests/unit/lib/queue-url.test.js` | Tests | Queue URL resolution and trailing slash tests |
| `tests/unit/services/PushNotificationService.test.js` | Tests | VAPID absent graceful handling |
| `tests/unit/webhooks/qstash-webhooks-security.test.js` | Tests | Webhook signature verification coverage |

---

## 13. No Database Schema Changes

> **Session 206 introduced zero database schema changes.**

No new Drizzle migrations were generated or applied. No `npm run db:generate` or `npm run db:migrate` is required when deploying this release.

The following **existing tables** are used by new features but were already present from previous migrations:

| Table | Schema File | Used By |
| :--- | :--- | :--- |
| `push_subscriptions` | `src/db/schema/security.js` | `PushNotificationService.sendToRecipients()` — subscription lookup and stale cleanup |
| `notification_preferences` | `src/db/schema/security.js` | Referenced by notification dispatch webhook |
| `student_import_logs` | `src/db/schema/registry.js` | Synchronous bulk import fallback path |
| `students` | `src/db/schema/registry.js` | Roll number and email collision detection |

---

## 14. Deployment Checklist

When deploying Session 206 to production:

### Required
- [ ] Run `npm install` — installs `web-push@^3.6.7` and updates `@sentry/nextjs` to `^10.70.0`
- [ ] Verify `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY` are set in production `.env`
- [ ] Verify `NEXT_PUBLIC_BASE_URL` is set (standardized queue URL resolution)

### Optional (Enable New Features)
- [ ] Generate VAPID keys: `npx web-push generate-vapid-keys`
- [ ] Set `VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT_EMAIL`
- [ ] Set `NEXT_PUBLIC_SENTRY_DSN` to activate Sentry error tracking

### Removed (Clean Up Old Env Vars)
- [ ] Remove `GOOGLE_CLIENT_ID` from production environment (no longer used)
- [ ] Remove `GOOGLE_CLIENT_SECRET` from production environment (no longer used)
- [ ] Remove `NEXTAUTH_URL` from production environment (no longer used)

### No Action Needed
- No database migrations required
- No breaking API contract changes
- Bulk import is fully backward compatible (QStash optional)
- Web Push is fully optional (graceful skip if VAPID not configured)
- Sentry is fully optional (graceful skip if DSN not set)

---

## Cross-References

- [Backend Architecture](../architecture/backend.md) — EventBus, QStash webhook patterns
- [Notifications Feature](../features/notifications.md) — Complete Web Push implementation
- [Lessons Learned](../development/lessons-learned.md) — Rule 12: Dual-key QStash guard
- [Migration History](./migration-history.md) — Session 206 entry
- [Resolved Incidents](./resolved-incidents.md) — Previous session forensics

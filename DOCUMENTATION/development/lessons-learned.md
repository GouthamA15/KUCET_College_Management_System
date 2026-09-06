# KUCET CMS - Comprehensive Project Lessons Learned

**Last Updated:** August 16, 2026  
**Status:** Mandatory Engineering Reference  
**Scope:** Architectural Post-Mortems, Production Lessons, and Defensive Guardrails.

---

## 1. Overview & Architectural Retrospective

Over the course of 206 development sessions, the KUCET College Management System evolved from a standard web app into an enterprise-grade academic platform. Along the way, critical bugs, security traps, deployment failures, and storage refactorings produced invaluable architectural insights.

This document synthesizes those key lessons into **12 Inviolable Rules** and defensive guardrails to prevent regressions.

---

## 2. Eighteen Inviolable Rules & Defensive Guardrails

### Rule 1: Never Store Roll Numbers as Filenames
- **The Pitfall:** Saving images as `24KUEC001.jpg` leaks PII, enables malicious file enumeration, and causes stale browser caching when a student updates their picture.
- **The Inviolable Guardrail:** ALWAYS generate cryptographically random UUIDs (`crypto.randomUUID()`) for file storage keys (`kucet/requests/pfp/7a59662b-8a4e.webp`).

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
- **The Inviolable Guardrail:** Store assets strictly in persistent external storage volumes (`/var/www/kucet-storage`) or Cloudinary.

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

### Rule 12: Always Cryptographically Sign and Verify Asynchronous Webhooks
- **The Pitfall:** Exposing public background webhook endpoints (e.g., `/api/webhooks/qstash/*`) without cryptographic signature verification allows unauthenticated external actors to trigger unauthorized batch operations, send spam notifications, or manipulate system tasks.
- **The Inviolable Guardrail:** ALWAYS wrap QStash webhook route handlers with `verifySignatureAppRouter()` and maintain synchronized `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY` credentials.

### Rule 13: Never Physically Delete Records on Rejection (Soft Rejection & History Preservation)
- **The Pitfall:** Executing physical SQL `DELETE` (`db.delete()`) and storage deletion (`storage.delete()`) on application rejections wipes historical student applications and proof assets permanently. This prevents staff from auditing past rejections, reviewing rejection rationales, or restoring erroneously rejected applicants.
- **The Inviolable Guardrail:** ALWAYS transition records to a `REJECTED` status enum in an atomic transaction, record the transition in `admission_status_history` / `audit_logs`, and preserve all uploaded media assets. Exclude `REJECTED` records from active duplicate constraints so applicants can re-apply if instructed.

### Rule 14: Never Track Deployment Scripts as Non-Executable & Always Use Unconditional Remote Git Sync in CI/CD Runners
- **The Pitfall:** Tracking scripts under `DEPLOYMENT_PACKAGE/SCRIPTS/` with Git file mode `100644` (non-executable) causes runtime `chmod +x` on the Linux VPS to mark the working tree as locally modified (`100644 -> 100755`). Running `git checkout $BRANCH` in automated runners then aborts with `Your local changes to the following files would be overwritten by checkout`. Furthermore, runner service account UID mismatches (e.g., `deployer` UID 1001 vs `kucet-dev` UID 1000) trigger `Permission denied` unlink errors during automated pulls.
- **The Inviolable Guardrail:**
  1. **Canonical Git Index Executable Bit:** ALWAYS track all deployment and operational shell scripts in the Git index with the executable bit explicitly set (`git update-index --chmod=+x DEPLOYMENT_PACKAGE/SCRIPTS/*.sh` -> mode `100755`).
  2. **Atomic Remote Reset in CI/CD:** In automated deployment scripts (`deploy.sh`, `rollback.sh`), NEVER invoke `git checkout` prior to resetting. ALWAYS perform atomic remote synchronization: `git fetch origin "$BRANCH" && git reset --hard "origin/$BRANCH" && git clean -fd`.
  3. **Dual-Group Production Ownership:** Ensure the production repository directory (`/var/www/kucet-cms`) is owned by `deployer:users` (UID `1001:100`) with `chmod -R u+rwX,g+rwX` so both automated GitHub Actions runners and SSH administration users operate without permission conflicts.
  4. **Cross-Shell Portability:** Always use `set -eu` and `set -o pipefail 2>/dev/null || true` rather than bare `set -euo pipefail` to avoid syntax failure across different subshell environments.

### Rule 15: Always Enforce Single-Process Deployment Locks and Rollback Cooldown Safeguards
- **The Pitfall:** When multiple CI/CD runs trigger concurrently or when automated health monitors detect transient failures, running un-gated deployment or rollback scripts causes parallel `docker compose build` races and infinite rollback loops. Furthermore, timestamped log proliferation without retention pruning leads to inode and disk exhaustion.
- **The Inviolable Guardrail:**
  1. **Deployment Mutex (`flock`):** Guard `deploy.sh` with a kernel-level lockfile (`/tmp/kucet_deploy.lock` via `flock -n 200`) so overlapping deployment runs exit immediately without corrupting container state.
  2. **Rollback Cooldown:** Enforce a minimum 30-minute cooldown marker (`/tmp/kucet_rollback_cooldown`) in self-healing monitor cron jobs (`monitor.sh`) to prevent cascading rollback loops during external infrastructure outages.
  3. **Deterministic Logrotate & Pruning:** Enforce static file rotation in `/etc/logrotate.d/kucet-cms` and automated 14-day log pruning (`find /var/log/kucet -name "*.log*" -mtime +14 -delete`) across all operational scripts.

### Rule 16: Enforce Ingress-Aware Realtime Socket Resolution & Clean Session Disconnects
- **The Pitfall:** Hardcoding WebSocket connection targets to `http://localhost:4000` causes public HTTPS clients to fail to connect due to Mixed Content security blocks and loopback misdirection. Additionally, retaining background socket listeners across user logout causes cross-session event bleed.
- **The Inviolable Guardrail:**
  1. **Dynamic Origin Resolution:** In `src/components/RealtimeListener.js`, dynamically resolve WebSocket ingress URLs to `window.location.origin` when accessing over HTTPS (allowing Nginx reverse proxying via `/socket.io/`), while falling back to direct port `4000` only on true local development.
  2. **Unconditional Logout Cleansing:** On all authentication logout paths (`src/lib/logout.js`), explicitly invoke `disconnectRealtimeSocket()`, purge all session/local storage auth tokens, and issue HTTP 1970 cookie expirations.

### Rule 17: Deterministically Clean Up Async Lifecycle Resources & Avoid Inline Callbacks in Realtime Listeners
- **The Pitfall:** (1) Returning cleanup functions from async functions inside `useEffect` leaves intervals and event listeners uncleaned because React ignores returned Promises. (2) Passing inline arrow callbacks to singleton event listeners (`<RealtimeListener onUpdate={(d) => ...} />`) causes the listener effect to tear down and re-register on every render.
- **The Inviolable Guardrail:** Store async cleanup closures in component-scoped mutable variables to call them in `useEffect` teardown. Stabilize realtime callbacks with `useRef` or empty-dep `useCallback` so singleton event subscriptions remain persistent and zero-churn across re-renders.

### Rule 18: Never Dispatch Transitions or Secondary State Setters Inside React State Updaters
- **The Pitfall:** Calling `startTransition(() => setOptimisticState(...))` or dispatching secondary state updates from inside a state updater callback (e.g., `setState(prev => { dispatchOtherState(); return next; })`) violates React 19 concurrent purity rules and triggers unrecoverable runtime crashes (`Minified React Error #479` / `dispatchOptimisticSetState`).
- **The Inviolable Guardrail:** State updater functions passed to `setState((prev) => ...)` MUST remain 100% pure without side effects. Perform transitions or multi-state synchronizations outside updater functions or consolidate them into a single batch updater (`setBatchAttendanceStatus`). Also ensure Edge proxy (`src/proxy.js`) forwards refreshed JWT tokens via `x-staff-auth` headers so downstream routes never encounter expired tokens immediately post-refresh.

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
- **Role Isolation Cookie Purging:** On authentication as any role, purge all companion cookies belonging to other roles (`staff_*`, `clerk_*`, `student_*`, `admin_*`) to guarantee strict domain isolation.

---

## 6. Cross-Session Caching & State Hygiene Invariants (Rule 13)

> [!CAUTION]
> **LESSON LEARNED: Dynamic Authenticated APIs Must Never Be Cached by Service Workers or HTTP Proxies!**  
> In Session 207, when Student A (e.g., Gautam) logged in on a shared computer after Student B (e.g., Uzair), Student B's profile data was served from the browser's Service Worker cache. This occurred because `public/sw.js` executed Stale-While-Revalidate caching on all unspecified `GET` requests without bypassing `/api/*`, and API routes lacked explicit anti-caching HTTP headers.

### Inviolable Cross-Session Hygiene Protocol:
1. **Service Worker `/api/` Bypass**: `public/sw.js` must bypass ALL `/api/*` paths unconditionally (`url.pathname.startsWith('/api/')`).
2. **Strict HTTP Anti-Caching Headers**: `apiResponse()`, `apiError()`, and `wrapHandler` must always emit:
   ```http
   Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
   Pragma: no-cache
   Expires: 0
   ```
3. **Session-Scoped Storage**: Browser `localStorage` and `sessionStorage` keys that track student activity (e.g., notification dismissals, request statuses) must always be roll-number-scoped (`key_${rollno}`) rather than global.
4. **Client & Service Worker Cache Purge on Login/Logout**:
   - On logout (`/api/*/logout`), servers must send `Clear-Site-Data: "cache", "storage"`.
   - On client logout and login switch, frontend must clear `caches.keys()`, `CLIENT_ASSET_CACHE` via `invalidateAssetCache()`, `sessionStorage`, and `localStorage`.
5. **Context Roll Mismatch Validation**: `StudentContext` must verify that newly fetched `/api/student/me` roll number matches the current state; if not, all child states (`academicPerformance`, `latestRequest`, `profileDetails`) are immediately purged.

---

## 7. Production Deployment & Storage Permission Invariants (Rule 14)

> [!CAUTION]
> **LESSON LEARNED: Docker Bind-Mount Permissions Require Explicit Directory Scoping, Not `chmod 777`!**  
> In Docker deployments with non-root containers (`nextjs`, `UID 1001`), bind-mounted host volumes inherit the underlying host permissions. Blind `chmod 777` or recursive `chown -R` across existing files compromises sensitive institutional assets (College Seal, Principal Signatures, Payment Screenshots).

### Inviolable Production Storage Protocol:
1. **Explicit Directory-Scoped Preparation**: Run [`prepare-storage.sh`](../../DEPLOYMENT_PACKAGE/SCRIPTS/prepare-storage.sh) before starting containers to ensure required upload subdirectories (`students/*`, `staff/*`, `requests/*`, `certificates/*`) are owned by `1001:1001` with mode `775`.
2. **Read-Only Institutional Assets**: Keep `kucet/institution/` (College Seal, Principal Signatures) set to `755` so the PDF engine can read assets while blocking unauthorized uploads or mutations.
3. **Isolated Database Backups**: Host database backups (`/var/kucet-db-backup/`) must remain strictly mode `700` and separate from the application media mount.
4. **Idempotent Network Attachments**: Deployment scripts must inspect container networks via `docker inspect` before invoking `docker network connect` to avoid daemon conflicts.
5. **Zero `chmod 777`**: Under no circumstances should `chmod 777` be used in deployment, rollback, or health-check scripts.

---

## 8. Realtime Lifecycle & Media Quota Guardrails (Rules 15 & 16)

### Rule 15: Always Bound & Clean Up Asynchronous Realtime Subscriptions
- **The Pitfall:** In SPA navigation, components creating `BroadcastChannel`, `setInterval()`, Supabase channel listeners, or Socket.io subscribers without strict cleanup accumulate background tasks upon repeated page switching, triggering `MaxListenersExceededWarning: Possible EventEmitter memory leak detected`.
- **The Inviolable Guardrail:** Every `useEffect` subscriber must return a deterministic teardown function. Broadcast channels must call `.close()`, polling intervals must have bounded attempt counters or clear on zero subscribers, and singleton registries (`statusSubscribers`, `eventSubscribers`) must clear heartbeat timers immediately when empty.

### Rule 16: Never Store Unbounded Base64 Payloads in LocalStorage Without Quota Guards
- **The Pitfall:** Writing raw base64 data URLs for user images into `localStorage` during draft auto-save can exceed browser storage quotas (~5MB), causing silent uncaught `QuotaExceededError` exceptions and broken form state persistence.
- **The Inviolable Guardrail:** Wrap `localStorage.setItem` calls in `try/catch` blocks that catch `QuotaExceededError` and fall back to storing structured text fields with media pointers (`{ pfp: null, signature: null }`), keeping client draft recovery intact.

### Rule 18: Pure Synchronous State Transformations in State Setters & Complete Auth Token Forwarding
- **The Pitfall:** (1) Invoking `startTransition` or asynchronous dispatchers inside a functional `setState(prev => ...)` updater triggers React's invariant violation (Minified React error #479: "Cannot update a component while rendering a different component"). (2) Next.js route handlers querying `headers()` without Edge proxy token injection can fail to read refreshed JWTs from cookies during silent refresh cycles, producing false 401 Unauthorized errors on dependent backend services.
- **The Inviolable Guardrail:** Functional state updaters passed to `useState`/`useReducer` MUST be pure, synchronous, and zero side-effect. Whenever `proxy.js` rotates auth tokens via silent refresh, it MUST forward the new token string directly to downstream API route handlers via explicit `x-[role]-auth` request headers.

### Rule 19: Never Bypass Edge Proxy Route Guards & Never Mutate React DOM via `parentNode.innerHTML` in Media Fallbacks
- **The Pitfall:** (1) Adding path-based bypasses (such as `!pathname.includes('...')`) in the Edge proxy/middleware creates security holes allowing unauthenticated requests to reach backend handlers even if inner wrappers exist. (2) Mutating `e.target.parentNode.innerHTML` inside an `onError` handler on Next.js `<Image />` destroys React's internal DOM Fiber nodes, triggering `NotFoundError: Failed to execute 'removeChild' on 'Node'` upon component re-render or tab switching.
- **The Inviolable Guardrail:** All `/api/admin/*` routes must be uniformly gated by Super Admin credentials in Edge proxy without exceptions. Image error handling MUST use pure React state (`const [imgError, setImgError] = useState(false)`) with conditional fallback JSX rendering, never direct DOM destruction.

---

## 9. Incident Summary Matrix

| Incident Tag | Root Cause | Engineering Fix Applied |
| :--- | :--- | :--- |
| **Session 205 Cookie Drop** | Next.js Edge proxy header comma-merging | Implemented raw `newCookiesToSet` array buffering in `src/proxy.js`. |
| **Session 204 DB Throttling** | High-frequency academic session queries | Added 5-minute in-memory cache to `getCurrentCalendarSession()`. |
| **Session 200 Storage Collision** | Mixed SDK calls and raw filenames | Enforced UUID v4 names and relative keys (`kucet/...`). |
| **Session 206 Webhook Vulnerability** | Unprotected asynchronous webhook endpoints | Added `verifySignatureAppRouter` across all 7 QStash routes. |
| **Session 207 Cross-Student Profile Leakage** | Service Worker SW Stale-While-Revalidate caching of `/api/*` & unscoped storage | Bypassed all `/api/*` in SW, bumped to `v3`, enforced `no-store` headers, roll-scoped storage keys, and complete login/logout cache purge. |
| **Session 207 Deployment & Storage Hardening** | Docker network reconnect conflict & non-root host bind-mount permission denial | Idempotent network checks, directory-scoped `prepare-storage.sh`, eliminated `chmod 777`, diagnostic health checks. |
| **Session 209 Production Readiness & Lifecycle Audit** | Transitive dependency deprecations, unbounded DOM polling, and localStorage quota risks on draft media | `npm audit fix` patch updates, bounded `ScrollHandler` poll loops, eager heartbeat interval cleanup in `RealtimeListener`, and quota-safe base64 draft persistence. |
| **Session 209 Memory & Lifecycle Resolution** | Next.js internal `httpxy` proxy listener accumulation during sequential silent refreshes; Socket.IO token expiry loops; uncleaned PWA worker intervals; duplicate realtime listeners | Route-scoped parallel silent refresh in `proxy.js`; automatic `/api/auth/refresh` on socket connect_error; deterministic Promise worker cleanup in `PwaRegister.js`; ref-hoisted single `<RealtimeListener>` in `PendingStaffRequests.js`. |
| **Session 210 CI/CD & Worktree Mode Drift** | Non-executable file mode `100644` in Git index caused runtime `chmod +x` to dirty working tree; `deploy.sh` called `checkout` before `reset --hard`; runner UID permission barrier | Set Git index mode `100755` via `git update-index --chmod=+x`, atomic `fetch -> reset --hard -> clean -fd` in runner, and `1001:100` (`deployer:users`) directory permissions. |
| **Session 211 Faculty Attendance & Admission Filters** | Minified React error #479 from `startTransition` inside `setState` updater; 401 Unauthorized on calendar load and proxy token refresh header omission; missing inline topic logging; single-branch admission restriction | Pure deterministic state in `FacultyAttendanceContext.js`, edge proxy `x-staff-auth` header injection, dual inline/modal topic logging, and multi-branch filter support in admission workspace. |
| **Session 212 Comprehensive Audit & Production Review** | Stray `/api/admin/staff-requests` proxy bypass, direct `parentNode.innerHTML` DOM mutation in `AdmissionModal.js`, unscoped role avatar in `MobileTopbar.js`, and undocumented non-teaching role shifting & modular edit modals | Removed proxy bypass, implemented pure React state fallback in `AdmissionModal.js`, path-scoped role context in `MobileTopbar.js`, updated full documentation suite. |

---

## 10. Cross-References & Related Documentation

- [Engineering Coding Standards](./coding-standards.md)
- [Project Architecture Conventions](./project-conventions.md)
- [AI Coding Agent Blueprint & Guidelines](./ai-agent-guide.md)
- [Chronological Forensics of Resolved Incidents](../history/resolved-incidents.md#1-session-205-forensic-resolution-of-cookies-remain-but-app-shows-home-screen)

> 💡 **Next Steps**: Review the complete incident post-mortems in [Resolved Incidents History](../history/resolved-incidents.md).


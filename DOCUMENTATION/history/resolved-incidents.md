# Chronological Forensics of Major Resolved Incidents

**Last Updated:** August 25, 2026
**Status:** Forensic Incident Repository  
**Scope:** Root Cause Analysis, Forensic Call Stacks, Resolution Steps, and Diagnostic Audits.

---

## Chronological Incident Matrix

| Session | Date | Category | Affected Subsystem | Primary Root Cause Summary | Resolution Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Session 211** | Sep 04, 2026 | React 19 State & Auth Proxy | Faculty Attendance & Admission Workspace | Minified React error #479 from `startTransition` inside `setState` updater in `FacultyAttendanceContext.js`; 401 Unauthorized errors on calendar load and proxy JWT refresh header omission; missing inline topic logging; multi-branch filter extension in admission workspace | **RESOLVED** |
| **Session 210** | Sep 03, 2026 | CI/CD & Git Worktree | GitHub Actions Runner & Scripts | Non-executable file mode `100644` in Git index caused runtime `chmod +x` to create unstaged mode diffs (`100755`); `deploy.sh` attempted `git checkout` before `git reset --hard`; runner user `deployer` (UID 1001) hit `Permission denied` on files owned by `kucet-dev` (UID 1000) | **RESOLVED** |
| **Session 209 (Part 2)** | Aug 31, 2026 | Performance & Lifecycle | Realtime, PWA, Proxy & Admin UI | `ServerResponse` MaxListeners warning from Next.js internal `httpxy` proxy during sequential multi-role silent auth refreshes; Socket.IO auth token expiry reconnection loops; uncleaned `setInterval` & `visibilitychange` in `PwaRegister.js`; duplicate `<RealtimeListener>` with unstable inline handlers in `PendingStaffRequests.js` | **RESOLVED** |
| **Session 209 (Part 1)** | Aug 31, 2026 | Deployment & DevOps | Multi-Service Stack & Nginx | `.dockerignore` excluded `DEPLOYMENT_PACKAGE` causing realtime build failure; `deploy.sh` only rebuilt `app`; Nginx DNS crashed on missing `kucet-cms-realtime:4000` upstream, closing port 80 and failing healthchecks | **RESOLVED** |
| **Session 208** | Aug 25, 2026 | DB Schema & API | Admin & HOD Analytics | `facultySubjectAssignments.faculty_id` Drizzle object mapping crash; Admin actor mismatch in `faculty_hod_assignments.assigned_by` FK | **RESOLVED** |
| **Session 207** | Aug 18, 2026 | Caching & State | Service Worker & Student State | `public/sw.js` Stale-While-Revalidate caching of `/api/*` across student logins; un-scoped `localStorage` keys | **RESOLVED** |
| **Session 206** | Aug 14, 2026 | Security & Media | Storage & Upload Pipeline | `FailoverStorageProvider` forwarded options object as `publicId` producing `[object Object].webp`; API routes assigned `StorageResult` object directly to DB string columns | **RESOLVED** |
| **Session 205** | Aug 11, 2026 | Auth / Proxy | Cookie Engine (`src/proxy.js`) | Next.js Edge header comma-merging corruption of `Set-Cookie` strings | **RESOLVED** |
| **Session 204** | Aug 11, 2026 | Auth / Routing | Super Admin Login | Client panel state mismatch in `LoginPanel.js` | **RESOLVED** |
| **Session 203** | Aug 10, 2026 | PDF Generation | Certificate Engine | Non-DOM `onError` prop passed to `@react-pdf` | **RESOLVED** |
| **Session 199** | Aug 10, 2026 | Cloud Storage | Cloudinary CDN | Double category prefix injection (`kucet/kucet/`) | **RESOLVED** |
| **Session 196** | Aug 08, 2026 | Media Pipeline | Asset View Proxy | Path corruption inserting `kucet/public/` | **RESOLVED** |
| **Session 183** | Aug 06, 2026 | CI / Testing | E2E Playwright Suite | Ambiguous DOM selectors violating strict mode | **RESOLVED** |
| **Session 176** | Jul 20, 2026 | Auth Security | OTP & Password Auth | Plaintext OTP storage & timing oracle | **RESOLVED** |

---

## Detailed Forensics & Technical Resolutions

### 0. Session 211: Forensic Resolution of Faculty Attendance Error #479, Proxy Auth Header Forwarding, Inline Topic Tracking & Admission Multi-Branch Filter

#### Incident Summary
Faculty members encountered recurring issues when accessing live attendance routes (`/staff/faculty/attendance/[assignmentId]/take/gps`, `.../manual`, `.../qr`):
1. **Minified React Error #479**: Unexpected React crash with error screen when toggling attendance status or performing batch actions.
2. **"Unauthorized" Poster / Error**: Loading the attendance page displayed 401 Unauthorized errors from the academic calendar component, and silent token refreshes failed to authenticate immediate downstream API requests.
3. **Missing "Topic Completed" Field**: Faculty could not view or record lecture topics directly on the attendance sheet before submitting attendance.
4. **Admission Multi-Branch Filter**: Admission workspace filters required extension to support selecting specific branches, multiple branches, or ALL branches simultaneously across Drafts and Finalized Students.

#### Root Cause Analysis
1. **React 19 Concurrency State Bug (`FacultyAttendanceContext.js`)**:
   - `toggleAttendanceStatus()` executed `startTransition(() => setOptimisticStatusMap(...))` *inside* the state updater function `setAbsentCountMap((prevStages) => ...)`.
   - In React 19 concurrent mode, state updater functions must be pure; dispatching an optimistic state transition from within another state computation violates React invariants and throws `dispatchOptimisticSetState` / Error #479.
2. **Auth Header Omission in Edge Proxy (`src/proxy.js`)**:
   - When silent token refresh was executed in `src/proxy.js`, the new JWT token was saved to `response.cookies` for subsequent requests, but omitted from the active downstream request headers (`requestHeaders.set('x-staff-auth', newAccessToken)`).
   - Consequently, Route Handlers on the active request evaluated the old/expired token from the incoming headers, returning 401 Unauthorized until a subsequent page reload.
3. **Calendar Endpoint Role Restriction (`/api/staff/academic-calendar`)**:
   - `GET /api/staff/academic-calendar` enforced `getAuthUser('hod')`, rejecting ordinary faculty members with a 401 toast error upon mounting `FacultyAcademicCalendar.js`.
4. **Topic Logging Architecture Decoupling**:
   - The lecture topic was only queried and displayed inside a post-session modal (`LectureTopicModal.js`) on "Stop Session", rather than being queried on date/session change or editable directly in the main attendance sheet.

#### Resolution Steps
1. **Deterministic State Management in `FacultyAttendanceContext.js`**:
   - Removed nested `startTransition` calls from inside state setters. Refactored the context to maintain deterministic `attendanceStatusMap` state.
   - Added `setBatchAttendanceStatus(updates)` to execute multi-student updates ("Confirm All", "Follow Previous Session") in a single render pass.
2. **Edge Proxy Request Header Injection (`src/proxy.js`)**:
   - Injected freshly minted access tokens directly into `x-staff-auth`, `x-admin-auth`, and `x-student-auth` request headers on the active request before forwarding to downstream Route Handlers.
3. **Granular Role Alignment**:
   - Updated `GET /api/staff/academic-calendar` to require `getAuthUser('staff')`, allowing all faculty to view academic calendar events while keeping `POST` restricted to HODs and Admins.
   - Extended `/api/staff/faculty/attendance/status` authorization to support assigned substitute faculty, department HODs, and Super Admins.
4. **Dual Inline & Modal Topic Completed Flow**:
   - Built inline quick-save panels into both `AttendanceSheet.js` (desktop) and `MobileAttendanceSheet.js` (mobile).
   - Enhanced `GET /api/staff/faculty/attendance/status` to fetch and auto-populate `topic_covered` from `attendance_sessions`.
   - Extended `POST /api/staff/faculty/attendance` to atomically persist `topic_covered` alongside student attendance marks.
5. **Admission Workspace Multi-Branch Filters**:
   - Refactored `src/lib/admission-workspace.js` to support comma-separated multi-branch parameters (`branch=CSE,ECE`), specific branch filtering, and "ALL" branches across `/api/staff/admission/drafts` and `/staff/admission/finalize`.

---

### 1. Session 210: Forensic Resolution of Git Working Tree Mode Drift, CI/CD Checkout Failures & Runner Permission Hardening

#### Incident Summary
GitHub Actions automated deployment workflow `Deploy to Production (KUCET CMS)` failed during the `2. Deploy to Production VPS` step. Inspection of runner logs revealed:
1. `error: Your local changes to the following files would be overwritten by checkout: DEPLOYMENT_PACKAGE/SCRIPTS/deploy.sh ...`
2. `error: unable to unlink old 'DEPLOYMENT_PACKAGE/SCRIPTS/...': Permission denied`
3. The deployment script aborted, triggering emergency rollback, which encountered the exact same working tree lock.

#### Root Cause Analysis
1. **Git File Mode Tracking Inconsistency (`100644` vs `100755`)**:
   - Deployment scripts in `DEPLOYMENT_PACKAGE/SCRIPTS/` were originally added to Git with non-executable file mode `100644`.
   - On the Linux production host, initialization and cron scripts executed `chmod +x` on the folder, altering file modes in the filesystem to `100755`.
   - Git tracked this executable bit change as unstaged local modifications. When subsequent CI/CD runs executed `git checkout "$BRANCH"`, Git refused to switch branches due to uncommitted working tree changes.
2. **Fragile Checkout Sequencing in `deploy.sh` and `rollback.sh`**:
   - The deployment script executed `git checkout` prior to `git reset --hard`. In automated deployment runners, `git checkout` fails defensively when unstaged modifications exist.
3. **Runner Service Account Permissions**:
   - The GitHub Actions runner daemon runs under user account `deployer` (UID `1001`, GID `1001`). Certain files in `/var/www/kucet-cms` had been created under `kucet-dev` (UID `1000`) with restrictive `755` permissions, preventing `deployer` from unlinking old files during checkout.

#### Resolution Steps
1. **Explicit Index Mode Tracking**:
   - Set canonical executable permissions directly in the repository Git index: `git update-index --chmod=+x DEPLOYMENT_PACKAGE/SCRIPTS/*.sh`.
   - Git now tracks all deployment scripts canonically as `100755`, preventing runtime `chmod +x` commands on Linux from dirtying the working tree.
2. **Atomic Remote Reset Pipeline**:
   - Refactored `deploy.sh` and `rollback.sh` to synchronize remote changes unconditionally using:
     ```bash
     git fetch origin "$BRANCH" 2>&1
     git reset --hard "origin/$BRANCH" 2>&1
     git clean -fd 2>&1
     ```
3. **Dual-Group Server Ownership Configuration**:
   - Configured `/var/www/kucet-cms` ownership to `1001:100` (`deployer:users`) with `chmod -R u+rwX,g+rwX`. Both `deployer` (CI runner) and `kucet-dev` (SSH administration) belong to group `users` (GID 100) and can modify/unlink files without permission barriers.
4. **Shell Flag Resilience**:
   - Replaced `set -euo pipefail` with `set -eu` and `set -o pipefail 2>/dev/null || true` across all shell scripts, ensuring compatibility across diverse subshells.

---

### 1. Session 209: Deep Forensic Resolution of EventEmitter Warnings, Socket.IO Auth Expiry, PWA Lifecycle Leaks & Proxy Concurrency

#### Incident Summary
The application logged repeated `MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 close listeners added to [ServerResponse]` originating through `next/dist/compiled/compression` and `next/dist/compiled/httpxy`. Concurrently, the browser console produced repeated `[Realtime] Socket connection error: websocket error` and the socket service container logged `[SocketAuth] Rejected connection attempt: "exp" claim timestamp check failed`. Furthermore, multiple API calls were triggered concurrently across page navigations, and custom diagnostic loggers emitted `[MEMORY LEAK TRACE]`.

#### Root Cause Analysis
Multi-layer forensic auditing of runtime instrumentation, server logs, container health metrics, and client lifecycles identified four distinct root causes:

1. **Proxy Internal HTTP Self-Fetch Listener Accumulation (`src/proxy.js`)**:
   - On every navigation, the edge proxy evaluated silent refresh sequentially for 3 roles (`admin`, `staff`, `student`) by making internal HTTP round-trips to `${origin}/api/auth/refresh`.
   - Each internal fetch passed through Next.js's standalone reverse proxy (`httpxy`), attaching a `close` listener to the incoming `ServerResponse` via the compiled compression middleware.
   - When 3 sequential silent refresh HTTP calls coincided with concurrent page asset or API queries, the number of simultaneous active `close` listeners exceeded Node.js's default limit of 10, triggering the `MaxListenersExceededWarning`.
   - *Crucially, heap analysis confirmed this was not a permanent memory leak* (container memory remained stable at 128-132 MiB / 7.4 GiB with 0% runaway heap growth), but rather a high-concurrency proxy overlap.

2. **Socket.IO Authentication Expiry on Reconnection (`src/components/RealtimeListener.js`)**:
   - `kucet-cms-realtime` enforces strict cryptographic JWT verification on handshake headers (`cookies.staff_auth`, etc.).
   - When short-lived JWT access tokens expired in the background, Socket.IO's automatic reconnection loop repeatedly presented the expired cookie, triggering rejection: `[SocketAuth] Rejected connection attempt: "exp" claim timestamp check failed`.
   - The client lacked an automated token refresh trigger on socket auth errors, leaving the socket in a continuous reconnection-rejection loop.

3. **Uncleaned Interval and Visibility Listener in `PwaRegister.js`**:
   - The asynchronous `registerWorker()` function returned a cleanup closure (`() => { clearInterval; removeEventListener }`), but `useEffect` did not receive or invoke the closure because it was wrapped inside an un-awaited Promise.
   - On component remounts or hot-reloads, the 15-minute background update `setInterval` and `document.addEventListener('visibilitychange')` remained registered indefinitely in the browser context.

4. **Duplicate `<RealtimeListener>` with Unstable Inline Callbacks (`PendingStaffRequests.js`)**:
   - `PendingStaffRequests.js` rendered separate `<RealtimeListener>` elements across conditional branches (loading vs empty vs table state), with inline arrow functions: `onUpdate={(data) => { if (data.type?.includes('staff')) fetchRequests(); }}`.
   - Because inline arrow functions generate a new function reference on every render, `RealtimeListener`'s internal effect was continuously torn down and re-registered, multiplying event subscription churn.

#### Resolution Steps
- **Route-Scoped Parallel Silent Auth Refresh (`src/proxy.js`)**:
  - Implemented role/pathway short-circuiting: `/admin/*` only refreshes `admin`, `/staff/*` only refreshes `staff`, `/student/*` only refreshes `student`, avoiding unnecessary internal HTTP proxy hops.
  - Converted sequential awaits into a single `Promise.all` execution, narrowing the concurrency window and eliminating `ServerResponse` close-listener pileup.
- **Automated Silent Token Refresh on Socket Auth Expiry (`src/components/RealtimeListener.js`)**:
  - Added intelligent error detection inside `sharedSocket.on('connect_error')` for expired/auth failure messages.
  - Automatically invokes `/api/auth/refresh` before Socket.IO's exponential backoff reconnects, seamlessly presenting fresh session cookies without user interruption or console spam.
- **Complete PWA Lifecycle Teardown (`src/components/PwaRegister.js`)**:
  - Captured the promise-resolved worker cleanup function and executed it in the `useEffect` return handler, ensuring `clearInterval` and `removeEventListener` execute deterministically on unmount.
- **Unified Canonical Realtime Listener & Ref-Hoisted Callback (`PendingStaffRequests.js`)**:
  - Hoisted a single, unconditionally mounted `<RealtimeListener>` component.
  - Stabilized `handleRealtimeUpdate` using `useRef` delegation so its callback reference never changes across re-renders, preventing listener churn.
- **Verification**: Verified 58 test files (454 unit tests) passed with 100% success rate, 0 ESLint warnings, and zero memory leaks.

---

### 2. Session 209: Forensic Resolution of Realtime Build Failure, Deployment Rollbacks & Nginx Upstream DNS Crashes

#### Incident Summary
Automated CI/CD deployments on the self-hosted Ubuntu production server succeeded at the Next.js application build stage (`kucet-cms-app`), but immediately rolled back during post-deployment health checks with `failed:health-check`. The proxy container (`kucet-cms-proxy`) entered a continuous crash-restart loop (`Restarting (1)`), all local curl requests returned `HTTP 000000` (Connection refused), and the public Tailscale Funnel endpoint intermittently timed out.

#### Root Cause Analysis
Forensic analysis of `/var/log/kucet/deploy_*.log` and Docker container logs identified three interconnected faults:

1. **Docker Build Context Exclusion in `.dockerignore`**:
   - `.dockerignore` contained `DEPLOYMENT_PACKAGE`.
   - When Docker BuildKit attempted to build `Dockerfile.realtime` via `COPY DEPLOYMENT_PACKAGE/CONFIGS/socket-server.js ./socket-server.js`, the file was filtered out by `.dockerignore`.
   - BuildKit failed with `"/DEPLOYMENT_PACKAGE/CONFIGS/socket-server.js": not found`, preventing the `kucet-cms-realtime` image from being created.

2. **Single-Service Build Scope in `deploy.sh` and `rollback.sh`**:
   - `deploy.sh` executed `docker compose up -d --build --no-deps app`, recreating only `kucet-cms-app` while omitting `realtime`.
   - `kucet-cms-realtime` remained in an un-started or non-existent state on the Docker network (`cms-network`).

3. **Nginx Upstream DNS Crash Loop**:
   - `nginx.conf` defined `upstream realtime_upstream { server kucet-cms-realtime:4000; }`.
   - When Nginx initialized, Docker internal DNS (127.0.0.11) could not resolve `kucet-cms-realtime`.
   - Nginx exited immediately: `2026/08/30 19:05:37 [emerg] host not found in upstream "kucet-cms-realtime:4000"`.
   - Because Nginx was down, port 80 refused connections (`HTTP 000000`), triggering an automated rollback.

4. **Undeclared Framework Dependency in Socket Server**:
   - `socket-server.js` imported `express`, which was not in `package.json` and not required for a microservice WebSocket server.

#### Resolution Steps
- **Un-ignore Deployment Configs in `.dockerignore`**: Removed `DEPLOYMENT_PACKAGE` from `.dockerignore`, enabling BuildKit to copy `socket-server.js` into `Dockerfile.realtime`.
- **Zero-Dependency Native HTTP Server**: Replaced `express` with Node.js built-in `http.createServer` in `DEPLOYMENT_PACKAGE/CONFIGS/socket-server.js` for instant `/health` probing and Socket.IO initialization without third-party frameworks.
- **Multi-Service Lifecycle in `deploy.sh` & `rollback.sh`**: Updated deployment scripts to build and start both `app` and `realtime` simultaneously (`up -d --build --no-deps app realtime`) and poll the health of both containers before reloading Nginx.
- **Hardened Health Checks (`health-check.sh`)**: Added 3-attempt retry loops for HTTP endpoints, direct `/health` check on port 4000 for `realtime`, and classified containers into critical (`app`, `realtime`, `proxy`, `db`, `redis`) vs optional (`monitor`).
- **Production Verification**: Confirmed all 17 health checks passed (HTTP 200) and public Tailscale Funnel returned `HTTP/2 200 OK`.

---

### 2. Session 208: Forensic Resolution of Drizzle ORM Mapping & Foreign Key Constraints

#### Incident Summary
Multiple internal 500 server errors were detected across HOD endpoints (`/api/staff/hod/faculty-load`, `/api/staff/hod/subject-assignments`, and `/api/staff/faculty/syllabus`), resulting in "TypeError: Cannot convert undefined or null to object" crashes on the frontend. Additionally, Admin attempts to promote Faculty to HOD via `PUT /api/admin/staff/[id]` resulted in Foreign Key constraint violations.

#### Root Cause Analysis
Forensic investigation revealed two distinct root causes:

1. **Foreign Key Context Mismatch on Administrative Actors**:
   - The database correctly separates system users (`principal`) from subject entities (`staff_accounts`).
   - The `faculty_hod_assignments.assigned_by` column was improperly defined in Drizzle to reference `staff_accounts.id`.
   - When the Super Admin (`principal.id = 1`) attempted to authorize an HOD promotion, it threw a FK violation because there is no `staff_accounts.id = 1`.

2. **Drizzle Schema Mapping Hallucination (`faculty_id` vs `staff_account_id`)**:
   - The physical database schema defines `staff_account_id` as the foreign key in `faculty_subject_assignments` and `faculty_subject_interests`.
   - The API codebase incorrectly attempted to query `facultySubjectAssignments.faculty_id`.
   - Because `faculty_id` was undefined in the schema object, Drizzle's internal `orderSelectedFields` received `undefined` inside the `db.select()` object map, throwing an immediate Type Error.

#### Resolution Steps
- **Repaired Administrative Foreign Keys**: Mapped `faculty_hod_assignments.assigned_by` and `faculty_hod_requests.reviewed_by` to strictly reference `principal.id` inside `src/db/schema/operations.js` with `onDelete: 'set null'`.
- **System-wide Schema Normalization**: Executed an automated regex migration across 13 distinct files (API routes and intelligence engine files), replacing all hallucinated references of `facultySubjectAssignments.faculty_id` and `facultySubjectInterests.faculty_id` with `staff_account_id`.
- **UI State Decoupling**: Updated `ManageStaffClient.js` to decouple the HOD toggle switch from immediate database execution, buffering edits locally until the Admin explicitly presses "Save Changes" with an interception confirmation modal.
- **Timezone-Safe Date Formatting**: Replaced direct `new Date().toLocaleDateString()` invocations in `HodAccessManager.js` with the robust `formatDate()` utility from `@/lib/date` to prevent browser-local timezone offsets from producing off-by-one day rendering artifacts.

---

### 2. Session 207: Forensic Resolution of Cross-Student Profile Cache Leakage

#### Incident Summary
When a student (Student A, e.g., Gautam) logged in on a browser previously used by another student (Student B, e.g., Uzair), Student B's profile data, signature, and activity notifications appeared instead of Student A's data.

#### Root Cause Analysis
Forensic investigation revealed three contributing root causes:

1. **Service Worker Stale-While-Revalidate Caching on Dynamic API Routes (`public/sw.js`)**:
   - `public/sw.js` implemented a general Stale-While-Revalidate caching strategy for all non-navigation `GET` requests that were not explicitly listed in `BYPASS_CACHE_PATTERNS`.
   - `BYPASS_CACHE_PATTERNS` only exempted `/api/auth/` and `/api/student/login`.
   - Consequently, when Student B fetched `/api/student/me`, `/api/student/signature`, `/api/student/academic-info`, and `/api/student/latest-request`, the Service Worker saved the JSON response payloads into CacheStorage (`kucet-cms-v2`).
   - When Student A authenticated subsequently, the Service Worker intercepted the `GET` API requests and served Student B's cached responses directly from CacheStorage before the network request could complete.

2. **Missing Anti-Caching HTTP Headers on API Endpoints (`src/lib/api-utils.js`)**:
   - `apiResponse()`, `apiError()`, and `wrapHandler` returned `NextResponse.json()` without `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` and `Pragma: no-cache` headers, permitting intermediate and browser HTTP caches to hold authenticated student payloads.

3. **Global Unscoped `localStorage` Keys in `ProfileActivityContext.js`**:
   - Notification counts and seen request IDs (`profileStatusBarSeenRequestId`, `profileStatusBarCount`) were stored using global keys without roll number scoping, causing Student A to inherit Student B's notification read/dismiss states.

#### Resolution Steps
- **Unconditional `/api/` Bypass in Service Worker (`public/sw.js`)**: Configured `public/sw.js` to immediately bypass the Service Worker for ALL requests starting with `/api/` (`url.pathname.startsWith('/api/')`), bumped cache version to `kucet-cms-v3`, and added a `CLEAR_ALL_CACHES` message listener.
- **Strict Anti-Caching Headers Across All API Responses (`src/lib/api-utils.js`)**: Enforced `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`, `Pragma: no-cache`, and `Expires: 0` on `apiResponse`, `apiError`, and `wrapHandler`.
- **`Clear-Site-Data` Header on Logout (`/api/*/logout`)**: Added `Clear-Site-Data: "cache", "storage"` header across all role logout routes (`/api/student/logout`, `/api/staff/logout`, `/api/admin/logout`, `/api/auth/logout`).
- **Client Cache Purging on Login and Logout (`src/lib/logout.js` & `LoginPanel.js`)**: On logout and successful login, purged all browser CacheStorage (`caches.keys()`), in-memory image cache (`invalidateAssetCache()`), `sessionStorage`, and `localStorage`.
- **Roll-Scoped Context State & Mismatch Reset (`src/context/StudentContext.js` & `ProfileActivityContext.js`)**: Added roll number scoping to local storage keys (`key_${rollno}`) and implemented roll-mismatch state resets in `StudentContext` ensuring that if an authenticated student changes, all previous state objects are cleared immediately.

---

### 2. Session 206: Forensic Resolution of Private Storage Security & `[object Object].webp` Image Upload Bug

#### Incident Summary
Users reported two distinct media asset issues:
1. **Public Asset Exposure**: Sensitive files (student profile photos, signatures, admission draft documents, payment proofs) were accessible via public direct URLs without authentication.
2. **`[object Object].webp` Filename & Signature Render Failure**: Signature and photo uploads reported success in UI toast messages, but uploaded images failed to load, previews remained blank, and stored keys in database columns were corrupted with literal string `"[object Object]"` or filenames like `%5Bobject%20Object%5D.webp`.

#### Root Cause Analysis
Forensic investigation revealed two root causes across the storage architecture and API routes:

1. **`FailoverStorageProvider` Options Forwarding Flaw**:
   - `FailoverStorageProvider.upload(fileBuffer, key, options = {})` declared parameter 3 as `options = {}`.
   - When executing `provider.upload(fileBuffer, key, options)`, it passed `options` (a JS object `{}`) as argument 3 (`publicId`) to `CloudinaryStorageProvider.upload(file, folder, publicId)`.
   - `uploadToCloudinary` evaluated `const randomFilename = publicId || (crypto.randomUUID())`. Because `{}` (empty object) is truthy in JavaScript, `randomFilename` evaluated to `{}` instead of falling back to a random UUID string.
   - Cloudinary SDK converted `public_id: {}` to string `"[object Object]"` and saved the file as `kucet/clerks/signatures/[object Object].webp`.

2. **Database Column `StorageResult` Object Assignment**:
   - API endpoints (`/api/clerk/update-profile`, `/api/clerk/admission/drafts/[id]`, `/api/clerk/admission/students/[rollno]`, `/api/public/admission`, `/api/student/requests`, `/api/student/signature`, `/api/bugs`) executed `updateData.signature = await storage.upload(...)`.
   - `storage.upload(...)` returns a `StorageResult` object (`new StorageResult({ path, url, filename, provider })`).
   - The API routes assigned the entire `StorageResult` JS object directly to database string columns (`clerks.signature`, `student_signatures.signature`, `student_admission_drafts.signature`, `student_request_images.payment_screenshot`).
   - Drizzle/MySQL stringified the JS object into literal text `"[object Object]"` in database columns.
   - When fetching profiles (e.g. `GET /api/clerk/me`), `imageHelper` / `getAssetUrl` received `"[object Object]"`. `getAssetUrl` guarded against `"[object"` strings and returned `""`, causing the UI to render an empty preview.

#### Resolution Steps
- **Centralized Asset Authorization Engine (`src/lib/asset-auth.js`)**: Implemented strict zero-trust authorization enforcing RBAC rules and ownership checks for all private media requests (`/api/assets/view/[...path]`).
- **Nginx Zero-Copy Serving (`DEPLOYMENT_PACKAGE/nginx/nginx.conf`)**: Configured protected `/internal_uploads/` location block with Nginx `internal;` directive for zero-copy `X-Accel-Redirect` serving.
- **Provider Parameter Sanitization (`FailoverStorageProvider.js` & `cloudinary.js`)**: Updated `FailoverStorageProvider.upload` to sanitize `publicId` and updated `uploadToCloudinary` to strictly enforce `typeof publicId === 'string' && !publicId.includes('[object')`, guaranteeing random UUID filename generation (`m9tzk81af3q2`).
- **API Storage Key Extraction**: Updated all API upload endpoints (`/api/clerk/update-profile`, `/api/clerk/admission/drafts/[id]`, `/api/clerk/admission/students/[rollno]`, `/api/public/admission`, `/api/student/requests`, `/api/student/signature`, `/api/bugs`) to extract `typeof res === 'string' ? res : res?.path`, ensuring primitive storage key strings are saved in the DB.

---

### 2. Session 205: Forensic Resolution of "Cookies Remain But App Shows Home Screen"

#### Incident Summary
Users attempting to navigate the portal or stay logged in experienced an issue where their browser retained auth companion cookies (`admin_logged_in`, `clerk_logged_in`, `student_logged_in`), yet protected routes repeatedly redirected them to the home screen (`/`) or returned HTTP 401 Unauthorized errors.

#### Root Cause Analysis
Forensic investigation across Commits `3aec92c` through `8785357` revealed three interconnected root causes:

1. **Next.js Edge Header Comma-Merging Corruption (`src/proxy.js`):** Next.js `NextResponse` header getters and `Headers.forEach()` standard Web API methods automatically join multi-value headers using commas. When proxy attempted to attach or copy multiple `Set-Cookie` strings (e.g. `admin_auth` JWT and `admin_logged_in`), the header getter merged them into a single comma-separated string (`Set-Cookie: admin_auth=...; Path=/, admin_logged_in=true; Path=/`). Browsers parsed this as a malformed single cookie or rejected it entirely, resulting in access tokens failing to store while companion cookies remained.
2. **Missing Access Token Edge Case:** When `Max-Age`/`Expires` deleted the short-lived access token cookie (`admin_auth`) from the browser, `src/proxy.js` initially checked `!adminRes.payload && adminRes.expired`. Because `adminAuth` was undefined (missing rather than expired), silent refresh was bypassed, sending the user to the home screen despite valid refresh tokens in the database.
3. **Grace Period Inadvertent Reset in Token Reuse Revocation:** In `/api/auth/refresh/route.js`, when a revoked token was re-submitted, the revocation query executed an unqualified `db.update(refreshTokens).set({ revoked_at: now })`. This updated already-revoked token records, resetting their `revoked_at` timestamp to `NOW()` and accidentally re-opening the 30-second grace window for subsequent requests.

#### Resolution Steps
- **Raw `newCookiesToSet` Array Invariant (`src/proxy.js`):** Replaced all header getters (`getSetCookie()`, `Headers.forEach()`) in proxy with a raw JS string array invariant `let newCookiesToSet = []`. All newly issued or purged cookies are pushed to `newCookiesToSet` as un-merged raw strings and appended directly via `response.headers.append('set-cookie', cookieStr)`.
- **Redirect Cookie Forwarding (`withCookies`):** Created `withCookies()` helper inside `src/proxy.js` to ensure `newCookiesToSet` array elements are appended to 303 redirect responses.
- **Silent Refresh Condition Fix:** Updated proxy condition to `(!adminAuth || adminRes.expired)` so missing access token cookies trigger silent refresh when companion session cookies exist.
- **Explicit HTTP 1970 Expiration Headers:** Standardized cookie deletion across `/api/admin/logout`, `/api/auth/logout`, `/api/clerk/logout`, `/api/student/logout`, and proxy refresh failure handling by issuing explicit HTTP 1970 expiration strings (`Set-Cookie: ${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`).
- **SQL Condition for Revocation:** Added `sql\`${refreshTokens.revoked_at} IS NULL\`` to the token revocation query in `/api/auth/refresh/route.js`.
- **In-Memory Academic Session Caching:** Added 5-minute in-memory caching (`CACHE_TTL = 300,000ms`) in `src/lib/academic-utils.js` for `getCurrentCalendarSession()`.

---

### 2. Session 204: Forensic Resolution of Super Admin Login Redirect Bug

#### Incident Summary
Super Admin users logging into `/employee-login` were successfully authenticated by the server but were unexpectedly redirected to the Student Login page (`/student/login`) instead of the Super Admin Dashboard (`/admin/dashboard`).

#### Root Cause Analysis
Forensic investigation revealed two contributing flaws:
1. **Client Panel State Dependency (`LoginPanel.js`):** The form submission handler (`handleEmployeeSubmit`) evaluated local React tab state `activePanel === 'clerk'` to determine post-login navigation, completely ignoring the server-returned `data.role` property. When logging in with Super Admin credentials while the UI tab was toggled to Clerk, it routed to the clerk path, triggering middleware role rejection and redirecting to student login.
2. **Companion Cookie Contamination:** Logging in as a new role did not clear pre-existing auth cookies for other roles (`clerk_auth`, `student_auth`), causing middleware auth ambiguity.

#### Resolution Steps
- Refactored `handleEmployeeSubmit` in `src/components/LoginPanel.js` to route dynamically based on server payload:
```javascript
// Fixed Navigation Routing
const targetDashboard = getDashboardPathByRole(data.role); 
// Returns '/admin/dashboard' for role === 'admin'
router.push(targetDashboard);
```
- Updated `issueAdminAuthCookie()`, `issueClerkAuthCookie()`, and `issueStudentAuthCookie()` in `src/lib/auth-utils.js` to purge companion cookies of other roles upon login.
- Authored unit test suite `tests/unit/api/auth/admin-login.test.js` validating Super Admin authentication, role cookie isolation, and path resolution.

---

### 3. Session 203: Forensic Resolution of Certificate PDF Generation Failure

#### Incident Summary
Students attempting to download issued digital certificates (Bonafide, Conduct, Migration, ID Cards) received a generic error alert: *"An error occurred while generating the certificate"*.

#### Root Cause Analysis
Forensic log tracing identified two stacked failures:
1. **Primary Exception (`TypeError: Cannot read properties of undefined (reading 'style')`):** Triggered inside `@react-pdf/renderer` when a non-standard HTML DOM event handler was evaluated on the server:
   ```javascript
   // CRASH TRAP IN PDF TEMPLATE
   <Image src={logoUrl} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
   ```
   Because `@react-pdf/renderer` executes in a server-side Node.js environment without a DOM `window`, `e.currentTarget` was `undefined`, throwing a fatal runtime exception.
2. **Secondary Path Resolution Failure:** Next.js `.next/standalone` runner failed to resolve local disk signature assets when missing from ephemeral container storage.

#### Resolution Steps
- Audited all 9 PDF certificate templates and helper components (`CertificateHeader.js`, `SignatureBlock.js`, `QRBlock.js`, `CertificateWatermark.js`).
- Purged all HTML DOM event props (`onError`, `onClick`, `onLoad`) and HTML attributes (`alt`) from `@react-pdf` elements.
- Enhanced `InstitutionAssetService.getAssetBuffer()` to resolve candidate directories across parent directory levels (`../public`, `../../public`) and remote Cloudinary CDN URLs.
- Implemented binary magic number validation (`0xFF 0xD8` -> JPEG, `0x89 0x50` -> PNG) prior to passing image buffers to the PDF engine.

---

### 4. Session 199: Cloudinary Public ID Category Namespace Resolution

#### Incident Summary
User profile pictures and request verification documents uploaded prior to Session 198 began returning `HTTP 404 Not Found` when loaded from Cloudinary.

#### Root Cause Analysis
The Cloudinary storage account contained legacy media uploaded directly under root category folders (`requests/`, `students/`, `clerks/`). However, Session 198 updates to `getAssetUrl()` and `CloudinaryStorageProvider.getUrl()` unconditionally prepended `kucet/` to all relative keys, transforming `requests/pfp/7a59...webp` into `kucet/requests/pfp/7a59...webp` and triggering 404s.

#### Resolution Steps
- Updated `src/lib/assets.js` and `CloudinaryStorageProvider.js` with a root category detector:
```javascript
const ROOT_CATEGORIES = ['requests/', 'students/', 'clerks/', 'admission_drafts/', 'certificates/', 'bug_reports/', 'proofs/'];

export function isRootCategory(key) {
  return ROOT_CATEGORIES.some((cat) => key.startsWith(cat));
}
```
- If `isRootCategory(key)` evaluates to `true`, the URL builder preserves the root category path without injecting `kucet/`, guaranteeing 100% HTTP 200 responses across both legacy root assets and new `kucet/` prefixed assets.

---

### 5. Session 196: `kucet/public/` Path Corruption

#### Incident Summary
All user profile photos and certificate payment screenshots failed to load on the Render cloud testing environment.

#### Root Cause Analysis
`getAssetUrl()` and `CloudinaryStorageProvider.getUrl()` prepended `kucet/public/` to relative storage paths (e.g. `requests/pfp/abc.webp`), outputting public IDs such as `kucet/public/requests/pfp/abc.webp`, which did not exist on Cloudinary.

#### Resolution Steps
- Refactored `getAssetUrl()` and `CloudinaryStorageProvider.getUrl()` to strip `uploads/` and `public/` prefixes and build clean `kucet/${trimmedPath}` URLs matching Cloudinary public IDs.
- Updated `serveAssetResponse` in `src/lib/server-assets.js` to fallback to local disk asset resolution if remote Cloudinary fetches return non-200.

---

### 6. Session 183: CI E2E Test Suite Fix — Strict Mode Locators

#### Incident Summary
12 Playwright End-to-End tests failed in the GitHub Actions CI pipeline with `Error: strict mode violation`.

#### Root Cause Analysis
Playwright locators used generic text matching (e.g., `page.locator('text=Submit')`) which matched multiple visible elements on screen (e.g. "Submit Form", "Submit Query", "Re-submit").

#### Resolution Steps
- Refactored Playwright test files to use explicit data attributes (`data-testid="submit-admission-btn"`) and exact regex text matchers (`page.getByRole('button', { name: /^Submit$/ })`).
- Verified 100% pass rate across the E2E test suite in CI.

---

### 7. Session 176: Auth Security Hardening — OTP Hashing & Timing Attacks

#### Incident Summary
Security audit identified critical auth vulnerabilities:
1. Plaintext OTP codes stored in `otp_codes` table.
2. String `===` equality comparison during OTP verification susceptible to timing attacks.
3. Lack of per-account rate limiting allowing distributed brute-force attacks against single roll numbers.

#### Resolution Steps
- Refactored `send-otp` and `verify-otp` API routes: stored only SHA-256 hashes (`hashOtp()`) in the database; raw OTPs are emailed and never persisted.
- Replaced string comparison with timing-safe comparison:
```javascript
import crypto from 'crypto';

const isOtpValid = crypto.timingSafeEqual(
  Buffer.from(hashOtp(userSubmittedOtp)),
  Buffer.from(storedOtpHash)
);
```
- Added per-account rate limiting key (`login_student_acct:{rollno}`) allowing max 8 attempts per 30 minutes.

---

### 8. Session 207: Production Deployment Pipeline & Storage Bind-Mount Hardening

#### Incident Summary
1. **Docker Network Reconnection Conflict**: The deployment script threw `Error response from daemon: endpoint with name kucet-cms-app already exists in network deployment_package_cms-network` due to unconditional `docker network connect` on an already attached container.
2. **Storage Health Check Failure**: `health-check.sh` failed with `storage:writable FAIL /var/www/kucet-storage/public...` because it checked an obsolete legacy path (`/var/www/kucet-storage/public`), and container-level writes failed with `EACCES: permission denied` because host directories were owned by `deployer:deployer` (UID 1000) while the Next.js process ran as `nextjs` (UID 1001).
3. **Rollback Cascade Failure**: When deployment failed, `rollback.sh` checked out the previous commit which contained the legacy health-check script, causing rollback to fail identically.

#### Resolution Steps
1. **Idempotent Network Reconnection**: Added `docker inspect` check in [`deploy.sh`](../../DEPLOYMENT_PACKAGE/SCRIPTS/deploy.sh) and [`rollback.sh`](../../DEPLOYMENT_PACKAGE/SCRIPTS/rollback.sh) to verify network attachment before attempting connection.
2. **Modular Safe Storage Preparation ([`prepare-storage.sh`](../../DEPLOYMENT_PACKAGE/SCRIPTS/prepare-storage.sh))**:
   - Created a least-privilege storage preparation script executed before container startup.
   - Set directory ownership for UID 1001 on upload subdirectories (`students/pfp`, `staff/signatures`, `requests/proofs`, etc.) with mode `775`.
   - Protected institutional branding (`kucet/institution/`) with mode `755` (read-only for PDF document engine).
   - Preserved isolated database backup folder (`/var/kucet-db-backup/`, mode `700`).
   - Completely prohibited `chmod 777`.
3. **Diagnostic Health Check**: Removed all destructive mutation logic from [`health-check.sh`](../../DEPLOYMENT_PACKAGE/SCRIPTS/health-check.sh) and implemented non-colliding user-scoped temporary logs (`/tmp/kucet_health_check_${UID}.log`).
4. **CI/CD Workflow Alignment**: Updated [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) to execute deployment and rollback scripts directly from the workspace checkout.

---

## Cross-References & Related Documentation

- [Database & Infrastructure Migration Log](./migration-history.md)
- [System Architectural Decision Records (ADRs)](./architectural-decisions.md)
- [Old Cloudinary Storage Migration History](./old-cloudinary-migration.md)
- [Comprehensive Project Lessons Learned](../development/lessons-learned.md)


### 9. Session 208: E2E Forensic Audit & Security Remediation (August 29, 2026)

#### Incident Summary
1. **Build-time Memory Leak**: `inflight@1.0.6` warning during Next.js builds.
2. **Critical Security Vulnerabilities (P0)**: Hardcoded JWT_SECRET fallbacks and unrestricted file uploads found during E2E Deep Forensic Audit.

#### Resolution Steps
1. **Dependency Forensics**: Added nested npm overrides for `@ducanh2912/next-pwa` to force `workbox-build` to `7.4.0`, dropping `glob@7` and `inflight` without breaking builds.
2. **JWT Security Patch**: Rewrote JWT verification across `auth-utils.js`, `proxy.js`, and `api-utils.js` to explicitly `throw new Error()` if the secret is missing and `NODE_ENV === "production"`.
3. **MIME Validation Patch**: Added strict `image/` MIME type validation to payment screenshot uploads in `/api/student/requests/route.js`.

---

### 10. Session 208: Production Cache Forensics & Faculty Module Context Bug (August 29, 2026)

#### Incident Summary
The application exhibited stale components and stale Faculty/HOD API data in production. A normal browser refresh (F5) did not reliably load the latest state, while a hard refresh (Ctrl+Shift+R) immediately fixed it. 

#### Root Cause Analysis
An extensive forensic cache audit revealed a cascading failure across three overlapping caching layers:
1. **Next-PWA Aggressive RSC Caching (`next.config.mjs`)**: The `@ducanh2912/next-pwa` module was actively overwriting the custom `public/sw.js` during production builds. It was configured with `cacheOnFrontEndNav: true` and `aggressiveFrontEndNavCaching: true`, which aggressively intercepted and cached Next.js App Router dynamic RSC payloads (`?_rsc=...`) as well as HTML page payloads.
2. **Custom Service Worker Misconfiguration (`public/sw.js`)**: The custom fallback service worker (intended for Push Notifications) included a "Stale-While-Revalidate" fallback that erroneously caught *all* non-API `GET` requests, including Next.js `_rsc` data fetches, rather than being restricted to static assets (`_next/static/`, `.css`, images).
3. **React Context Stagnation (`StaffContext.js`)**: The `StaffContext` only fetched faculty assignments and HOD configuration once upon mount (`hasFetchedFaculty`), failing to re-validate when a user backgrounded the app or navigated away and back.

#### Resolution Steps
- **Next-PWA Removal**: Completely uninstalled `@ducanh2912/next-pwa` from `package.json` and removed `withPWAInit` from `next.config.mjs`. The project natively utilizes its own `public/sw.js` and manual registration (`PwaRegister.js`), making the external package redundant and destructive.
- **Service Worker Guardrails**: Fixed `public/sw.js` by explicitly restricting Stale-While-Revalidate caching to static asset paths (matching `/^_next\/static/` and common image/font extensions), bypassing the cache for all Next.js dynamic routing and RSC data.
- **State Revalidation**: Updated `StaffContext.js` `refreshAllData` and its dependency array to explicitly trigger `fetchFacultyData` and `fetchHODData` when resuming the application (`visibilitychange` / `pageshow`), ensuring context syncs across tabs without requiring a hard refresh.

---

### 11. Session 209: Forensic Resolution of Realtime Heartbeat Leak, Admission Draft Image Restoration, and SSC Decimal Precision (August 29, 2026)

#### Incident Summary
1. **Event Listener / Realtime Lifecycle Accumulation**: Node runtime `MaxListenersExceededWarning` and memory overhead under repeated navigation and tab cycling.
2. **Admission Draft Restoration Bug**: Saving an incomplete admission draft and clicking "Restore" restored text fields but failed to restore profile photo and signature previews.
3. **SSC / 10th Marks Decimal Limitation**: Public admission form rejected decimal marks/CGPA values (e.g., `9.5`, `8.75`, `98.4`).

#### Root Cause Analysis
1. **Instrumentation & Realtime Heartbeat Lifecycle**:
   - `src/instrumentation.js` attached `process.on('warning', ...)` unconditionally whenever instrumentation re-ran across server workers.
   - `src/components/RealtimeListener.js` ran `startSupabaseHeartbeat()` interval without auto-terminating when all active subscriber components unmounted, leading to orphan background intervals and channel re-subscription races.
2. **Admission Draft State Serialization Gap**:
   - `src/app/admission/page.js` debounced `localStorage.setItem('admission_form_draft', ...)` saving only `{ form, admissionYear }` while omitting `{ files }`.
   - Hidden `<input type="file" required>` prevented form submission upon restore because native browser file inputs cannot be programmatically hydrated from existing base64 strings or URLs.
3. **Frontend Decimal Step Limitation**:
   - Database schema already defined `student_academic_background.ssc_marks` and `student_admission_drafts.ssc_marks` as `varchar(50)`.
   - However, `src/app/admission/page.js` defined `<input type="number" min="0" />` without `step="any"`, triggering native browser constraint validation errors on decimal inputs.

#### Resolution Steps
- **Heartbeat & Event Listener Guard**: Added `globalThis._warningListenerRegistered` in `src/instrumentation.js` to ensure single warning handler attachment. Added auto-clear guard in `RealtimeListener.js` to cancel the heartbeat interval when all listener subscribers unmount, and wrapped `sharedSupabaseChannel.unsubscribe()` in defensive error boundaries.
- **Draft Media Restoration Pipeline**: Included `files` (`pfp`, `signature`) in localStorage draft serialization; restored both image previews on "Restore"; dynamically switched hidden file inputs to `required={!files.pfp}` / `required={!files.signature}` and updated button labels to "Change Photo" / "Change Signature".
- **Decimal Support**: Added `step="any"` and `placeholder="TOTAL MARKS / CGPA (e.g. 9.5 or 580)"` to `src/app/admission/page.js`. Validated compatibility across Zod schemas (`src/app/api/public/admission/route.js`, `src/lib/validations/student.js`) and database columns (`varchar(50)`).
- **Automated Regression Suite**: Created `tests/unit/admission-restoration-and-decimals.test.js` validating decimal parsing, full draft serialization/deserialization with base64 images, legacy draft fallback, and listener idempotency. All 53 test files (395 tests) passed.

---

### 12. Session 209 (Part 2): Forensic Resolution of Admin Staff Requests Regression, Schema Drift & Migration Journal Re-alignment (August 30, 2026)

#### Incident Summary
1. **Admin Staff Requests Failure**: Navigating to `/admin/staff-requests` failed in production with error `Unknown column 'staff_registration_requests.address' in 'field list'`.
2. **Missing Journal Migrations & Drizzle Alter Failure**: Deployment logs showed `Duplicate column name 'topic_covered'` when Drizzle's official `migrate()` attempted to re-run historical migration 0007 on a database where historical migrations had not been recorded in `__drizzle_migrations`.

#### Root Cause Analysis
1. **Schema Drift on `staff_registration_requests.address`**:
   - `src/db/schema/identity.js` defined `address: text('address')` on `staffRegistrationRequests` for staff residential address collection.
   - The production VPS database table `staff_registration_requests` was created prior to this definition and was missing the `address` column.
   - When `/api/admin/staff-requests` ran `db.select().from(staffRegistrationRequests)`, Drizzle requested all schema columns including `staff_registration_requests.address`, causing MySQL to throw error `1054: Unknown column 'staff_registration_requests.address' in 'field list'`.
2. **Drizzle Migration Journal & Tracker Disconnect**:
   - `drizzle/meta/_journal.json` contained entries `0000` through `0005`, but the baseline `.sql` files on disk had been removed in previous refactorings.
   - When Drizzle ORM's `migrate()` ran on startup on an empty `__drizzle_migrations` table, it failed on historical `ALTER TABLE` statements (such as `0007_flippant_harry_osborn.sql` adding `topic_covered`) that had already been executed in the past.
3. **Frontend Promise.all Failure Coupling**:
   - `src/app/admin/staff-requests/StaffRequestsClient.js` used `Promise.all([fetch('/api/admin/staff-requests'), fetch('/api/admin/hod-requests')])`. The failure of one endpoint caused the entire page to abort.
4. **App Router Param Extraction & Active HOD Query**:
   - `approve`, `reject`, and `resend-activation` endpoints relied on fragile URL segment splitting.
   - `/api/admin/hod-requests` filtered `gte(end_date, nowStr)` without checking `isNull(end_date)`, filtering out active open-ended HOD tenures.

#### Resolution Steps
1. **Forward-Only Additive Migration 0017**:
   - Created `drizzle/0017_add_staff_registration_address.sql` (`ALTER TABLE staff_registration_requests ADD COLUMN address text NULL AFTER designation;`) and registered entry 17 in `_journal.json`.
2. **Automated Migration Baselining Engine**:
   - Updated `src/db/migrate.js` to inspect `__drizzle_migrations` and `information_schema.columns`. When an existing production schema is detected without complete tracking, it automatically baselines historical migrations (`0000`–`0015`) so Drizzle only executes new forward-only migrations (`0016`, `0017`).
3. **Deployment Safety & Smoke Tests**:
   - Updated `DEPLOYMENT_PACKAGE/SCRIPTS/deploy.sh` to create an automated pre-migration database snapshot via `nightly-backup.sh` before running migrations.
   - Added automated smoke test checks in `DEPLOYMENT_PACKAGE/SCRIPTS/health-check.sh` verifying `/api/admin/staff-requests` and `/api/admin/hod-requests` return healthy non-500 HTTP responses.
4. **Endpoint Hardening & Resilient UI**:
   - Hardened parameter resolution (`(await context.params)?.id`) and HTTP 400 error handling in all staff mutation routes.
   - Refactored `StaffRequestsClient.js` to use `Promise.allSettled()`.
   - Updated HOD queries to support `or(isNull(end_date), gte(end_date, nowStr))`.
5. **Live Verification on Production VPS**:
   - Live endpoint verification on production container confirmed:
     - `GET /api/admin/staff-requests` $\rightarrow$ `HTTP 200` (`success: true`, 8 requests)
     - `GET /api/admin/hod-requests` $\rightarrow$ `HTTP 200` (`success: true`)
      - `GET /admin/staff-requests` $\rightarrow$ `HTTP 200`
    - All 54 test files (404 unit tests) passed cleanly.

---

### 13. Session 209 (Part 3): CI Failure Forensic Fix — Staff Requests Unit Mocking & Database Error Sanitization (August 30, 2026)

#### Incident Summary
GitHub Actions CI pipeline failed with 1 failing test:
- **Test File:** `tests/unit/api/admin/staff-requests-workflow.test.js`
- **Failing Route:** `GET /api/admin/staff-requests`
- **Assertion:** `expect(res.status).toBe(200)` (Expected: 200, Received: 500)

#### Forensic Root Cause Analysis
1. **Unmocked Database Connection in Unit Test Environment (Category B - Test/Mock Drift):**
   - The test file `tests/unit/api/admin/staff-requests-workflow.test.js` was introduced without mocking `@/db` or providing Drizzle query builder mocks, unlike all other unit tests in `tests/unit/api/`.
   - In CI (or any test environment without a live MySQL instance running on localhost:3306), executing `GET /api/admin/staff-requests` invoked `db.select().from(staffRegistrationRequests)...` against an unmocked client.
   - The connection failed with `ECONNREFUSED 127.0.0.1:3306`, which threw `DrizzleQueryError`, logged `[API_CRASH]`, and caused `wrapHandler` to return `HTTP 500`.
2. **Missing Client Error Sanitization Pattern for Raw Connection Errors:**
   - In `src/lib/api-utils.js`, `wrapHandler`'s error sanitizer checked `connect econnrefused` as a fixed substring, allowing other connection/driver error variants to leak raw message internals rather than returning standard user-safe messages.
3. **Route Null-Safety Defensiveness:**
   - In `src/app/api/admin/staff-requests/route.js`, department/program lookups and JSON affiliation arrays did not have complete defensive null checks when mapping empty results.

#### Resolution Steps
1. **Isolated In-Memory Unit Test Suite (`staff-requests-workflow.test.js`):**
   - Overhauled `tests/unit/api/admin/staff-requests-workflow.test.js` with comprehensive, isolated in-memory dataset mocking for `@/db`, `@/lib/auth`, `@/lib/email`, and `@/lib/sse`.
   - Created 18 exhaustive workflow tests covering:
     - `GET /api/admin/staff-requests`: Unauthenticated (401), Authenticated with full mapping and `address` verification (200), Empty requests list (200), Database failure controlled error (500).
     - `POST /api/admin/staff-requests/[id]/approve`: Unauthenticated (401), Invalid ID (400), Successful approval with account creation and email dispatch (200).
     - `POST /api/admin/staff-requests/[id]/reject`: Unauthenticated (401), Reason too short (400), Successful rejection (200).
     - `POST /api/admin/staff-requests/[id]/resend-activation`: Unauthenticated (401), Successful token generation and email resend (200).
     - `GET /api/admin/hod-requests`: Unauthenticated (401), Authenticated with current HOD name enrichment (200), Empty requests list (200).
     - Schema column integrity assertions for `staffRegistrationRequests`, `staffAccounts`, and `facultyHodAssignments`.
2. **Database Error Sanitization & Structured Logging Hardening (`api-utils.js`):**
   - Updated `src/lib/api-utils.js` `wrapHandler` fallback error sanitizer to check `econnrefused`, `econnreset`, `etimedout`, and `drizzlequeryerror` (case-insensitive), returning `"Failed to connect to the database."` to clients while preserving full structured error details (`method`, `url`, `duration`, `ip`, `err`, `cause`, `stack`) in Pino server logs (`[API_CRASH]`).
3. **Defensive Null-Safety in API Route (`staff-requests/route.js`):**
   - Hardened `(depts || []).forEach(...)`, `(progs || []).forEach(...)`, and affiliation array mappings.
4. **Intelligent Forward-Only Migration Baselining (`src/db/migrate.js`):**
   - Hardened `src/db/migrate.js` to inspect `information_schema.columns` and `information_schema.tables` for existing tables (`academic_departments`) and columns (`staff_registration_requests.address`).
   - Automatically baselines migrations 0016 and 0017 in `__drizzle_migrations` when existing production schema already contains these structures, preventing `Duplicate column name 'address'` errors during automated CI/CD migration runs.
5. **Verification & Regression Testing:**
   - 100% pass rate across all 54 test files (413 unit tests passed, 0 failed, 0 skipped).
   - Zero ESLint errors across the codebase.

---

### 14. Session 211: CI E2E Playwright Attendance Routing & Enterprise Offline Resilience (September 04, 2026)

#### Incident Summary
GitHub Actions CI pipeline failed with:
- 7 failures in `tests/attendance-routing.spec.js` (deep linking, refresh persistence, back button navigation, and missing assignment states).
- 1 failure in `tests/enterprise-features.spec.js` (`net::ERR_INTERNET_DISCONNECTED` on offline fallback page test).

#### Root Cause Analysis
1. **Attendance Mock Route Matching Gap (`tests/attendance-routing.spec.js`):**
   - `page.route('/api/staff/faculty/assignments', ...)` used an exact string match without query parameter support.
   - When the client fetched `/api/staff/faculty/assignments?id=101`, Playwright bypassed the mock and hit the live backend, returning unauthenticated/empty data.
   - Companion APIs (`/api/staff/academic-calendar*`, `/api/staff/faculty/attendance/status*`) were unmocked in test suite runs.
2. **Fallback Subject Assignment Selection Bug (`src/app/staff/faculty/attendance/[assignmentId]/...`):**
   - In `[assignmentId]/page.js`, `take/[mode]/page.js`, and `history/page.js`, the assignment resolver used `(data.data || []).find(a => String(a.id) === String(assignmentId)) || data.data?.[0]`.
   - The `|| data.data?.[0]` fallback erroneously matched the first available subject when navigating to a non-existent ID (e.g. `99999`), preventing the "Assignment Not Found" state from displaying.
3. **Offline Navigation Execution Failure (`tests/enterprise-features.spec.js`):**
   - `page.goto('/offline')` was called after `page.context().setOffline(true)`, attempting network socket establishment over a disconnected context and throwing `net::ERR_INTERNET_DISCONNECTED`.

#### Resolution Steps
1. **Robust Playwright Route Interception (`tests/attendance-routing.spec.js`):**
   - Updated `page.route` to match regex `/\/api\/staff\/faculty\/assignments(\?.*)?$/` and filter data by `?id=...` or `?assignment_id=...`.
   - Added mock handlers for `/api/staff/academic-calendar*`, `/api/staff/faculty/attendance/status*`, and `/api/staff/faculty/interests*`.
2. **Exact Assignment Resolution & Consistent UI (`src/app/staff/faculty/attendance/...`):**
   - Removed `|| data.data?.[0]` fallback across `[assignmentId]/page.js`, `take/[mode]/page.js`, and `history/page.js`.
   - Standardized "Assignment Not Found" heading and "Back to Academics" navigation for non-existent IDs.
3. **DOM Event Offline Emulation (`tests/enterprise-features.spec.js`):**
   - Navigated to `/offline` before disconnecting, then dispatched `window.dispatchEvent(new Event('offline'))` to test client `useSyncExternalStore` reactive offline banners without socket timeouts.
4. **Verification:**
   - Vitest unit tests: 60/60 files passed (475/475 tests).
   - Playwright E2E: 23/23 tests passed across all test suites.
   - Next.js Turbopack production build: 208/208 static pages generated cleanly.

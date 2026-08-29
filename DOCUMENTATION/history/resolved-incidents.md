# Chronological Forensics of Major Resolved Incidents

**Last Updated:** August 25, 2026
**Status:** Forensic Incident Repository  
**Scope:** Root Cause Analysis, Forensic Call Stacks, Resolution Steps, and Diagnostic Audits.

---

## Chronological Incident Matrix

| Session | Date | Category | Affected Subsystem | Primary Root Cause Summary | Resolution Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
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

### 1. Session 208: Forensic Resolution of Drizzle ORM Mapping & Foreign Key Constraints

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



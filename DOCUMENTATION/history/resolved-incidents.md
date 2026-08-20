# Chronological Forensics of Major Resolved Incidents

**Last Updated:** August 11, 2026  
**Status:** Forensic Incident Repository  
**Scope:** Root Cause Analysis, Forensic Call Stacks, Resolution Steps, and Diagnostic Audits.

---

## Chronological Incident Matrix

| Session | Date | Category | Affected Subsystem | Primary Root Cause Summary | Resolution Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
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

### 1. Session 207: Forensic Resolution of Cross-Student Profile Cache Leakage

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

## Cross-References & Related Documentation

- [Database & Infrastructure Migration Log](./migration-history.md)
- [System Architectural Decision Records (ADRs)](./architectural-decisions.md)
- [Old Cloudinary Storage Migration History](./old-cloudinary-migration.md)
- [Comprehensive Project Lessons Learned](../development/lessons-learned.md)

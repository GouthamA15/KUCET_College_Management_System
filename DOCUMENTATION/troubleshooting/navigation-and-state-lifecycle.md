# Forensic Analysis: Client-Side Navigation, Context Lifecycles & State Resilience

**Subsystem:** Navigation, State Management, Authentication Proxy & Service Worker  
**Status:** Resolved  
**Version:** Session 209 Invariant Update  

---

## 1. Executive Summary & Root Cause Analysis

An investigation was conducted into reports of intermittent navigation failures, unexpected page reloads, and state resets during client-side navigation.

The forensic audit revealed three distinct, intersecting root causes:

### Root Cause 1: Access Token Expiration in `proxy.js` without Middleware Silent Rotation
- **Symptom:** After 15 minutes of user inactivity or active usage, clicking any internal sidebar link or performing programmatic navigation caused the request to abruptly redirect to `/`, discarding the target page and resetting UI state.
- **Forensic Mechanism:** Access tokens (`admin_auth`, `staff_auth`, `student_auth`) have a 15-minute lifespan. In `src/proxy.js`, expired access tokens were passed to `handleUnauthorized(request)` which returned `NextResponse.redirect(new URL('/', request.url), 303)`. Although companion refresh tokens existed in cookies, `proxy.js` did not rotate them during route transitions.
- **Resolution:** Implemented `trySilentRefresh()` in `src/proxy.js`. When an access token expires while a companion refresh token exists, `proxy.js` automatically rotates the session via `/api/auth/refresh`, applies the new `Set-Cookie` headers to `NextResponse`, and permits the user to navigate seamlessly without redirecting to `/`.

### Root Cause 2: Aggressive Window Focus Revalidation in React Contexts
- **Symptom:** Switching browser tabs or returning to a page caused full-screen loading spinners to appear and form data to reset.
- **Forensic Mechanism:** `AdminContext`, `StaffContext`, and `StudentContext` attached `window.addEventListener('focus', onResume)` with a 5000ms throttle. Whenever focus shifted, `handleResume` set `loading: true` even when valid cached data was already present in state, causing layouts (such as `ActivationGuard`) to unmount child pages.
- **Resolution:**
  1. Increased the background revalidation throttle from 5s to 60s.
  2. Changed `refreshAll` / `refreshData` / `handleResume` so they only set `loading: true` if no cached data exists in memory (`!dataRef.current`). Background revalidations update state in-place without unmounting active pages.
  3. Stabilized callback dependency arrays using `useRef` to prevent unnecessary component re-evaluations.

### Root Cause 3: Plain `<a>` Tags and Next.js RSC Service Worker Interception
- **Symptom:** Certain links caused full browser reloads, and mobile browsers occasionally intercepted client-side navigation flight data with offline HTML.
- **Forensic Mechanism:**
  1. Several student portal components (`ProfileWarningBar.js`, `verification-required/page.js`) used plain `<a href="...">` tags instead of Next.js `<Link>`.
  2. The Service Worker fetch listener (`public/sw.js`) did not explicitly bypass Next.js React Server Component (RSC) flight requests (`_rsc` query params and `RSC: 1` headers).
- **Resolution:**
  1. Replaced all internal `<a>` tags with `<Link>`.
  2. Added an explicit bypass in `public/sw.js` for all Next.js RSC requests (`url.searchParams.has('_rsc') || request.headers.get('RSC') === '1' || url.pathname.startsWith('/_next/data/')`).

---

## 2. Context Lifecycle Architecture

```text
RootLayout (src/app/layout.js)
├── PwaRegister (Service worker registration & chunk load recovery)
├── SystemConfigProvider (Global maintenance mode & theme tokens)
└── AssetProvider (Client image CDN URL memoization)

  Admin Layout (src/app/admin/layout.js)
  └── AdminProvider (src/context/AdminContext.js)
      ├── Holds: adminData, staffList, studentStats, collegeInfo
      └── Scope: Persists across ALL /admin/* sub-route navigations

  Staff Layout (src/app/staff/layout.js)
  └── StaffProvider (src/context/StaffContext.js)
      ├── Holds: staffData, pendingRequests, requestsHistory, admissionDrafts
      └── Scope: Persists across ALL /staff/* sub-route navigations

  Student Layout (src/app/student/layout.js)
  └── StudentProvider (src/context/StudentContext.js)
      └── ProfileActivityProvider (src/context/ProfileActivityContext.js)
          ├── Holds: studentData, certificateRequests, academicPerformance
          └── Scope: Persists across ALL /student/* sub-route navigations
```

---

## 3. Verification & Invariants

1. **Seamless Client-Side Navigation:** Sidebar links and programmatic navigation use Next.js `<Link>` and `router.push()`, preserving layout trees and state.
2. **Silent Token Rotation:** `proxy.js` rotates expired access tokens during navigation without dropping users to the login screen.
3. **No Visual Flickers on Focus:** Window focus revalidation runs in the background without setting `loading: true` or unmounting active views.
4. **Service Worker Safety:** Next.js RSC flight data and dynamic `/api/*` endpoints completely bypass the Service Worker cache.

# Incident Report: Session 209 — Tailscale Connectivity, Next.js ChunkLoadErrors & PWA Caching Reliability

**Date:** August 30, 2026  
**Status:** RESOLVED & VERIFIED  
**Impacted Systems:** Production Self-Hosted Node (`kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc.tailf6b4a7.ts.net`), Client-Side Routing, PWA Offline Engine  
**Severity:** Medium (Intermittent connectivity timeouts & post-deployment client navigation failures)

---

## 1. Executive Summary

During Session 209, a forensic investigation was conducted to address three interconnected production issues:
1. **Tailscale Ingress Availability:** The public Tailscale HTTPS domain occasionally experienced `ERR_TIMED_OUT` despite healthy Docker containers.
2. **Next.js Chunk Loading Failures:** Following container rebuilds, active client sessions encountered `Failed to load chunk /_next/static/chunks/[chunk].js` requiring manual hard refreshes.
3. **Stale UI & PWA Cache Behavior:** Old component states persisted after deployments, and temporary server restarts caused the PWA to incorrectly display "You are Offline".

---

## 2. Root Cause Analysis (RCA)

### 2.1 Tailscale & Host Ingress
- **Desktop PC Hardware Power Saving:** The production node is an HP Pro Tower desktop PC running Ubuntu Linux. Default OS power-management policies enabled sleep/suspend states for idle network interfaces, causing incoming packets to time out while Docker containers remained marked as healthy internally.
- **Tailscale Serve Forwarding Loopback:** Forwarding target `localhost:80` intermittently resolved to IPv6 `::1` rather than IPv4 `127.0.0.1`, leading to connection resets when Docker bound port 80 to IPv4.

### 2.2 Next.js Build Asset Replacement
- In `deploy.sh`, `docker rm -f kucet-cms-app` destroyed the running container containing previous build assets.
- Active client sessions with build $N$ HTML loaded in memory requested build $N$ chunk hashes during client-side navigation.
- The new container (build $N+1$) returned HTTP 404 for obsolete chunk hashes, throwing uncaught `ChunkLoadError` exceptions.

### 2.3 Service Worker & PWA Caching Flaws
- `public/sw.js` had a hardcoded cache name (`kucet-cms-v3`), preventing automated cache eviction on deployments.
- The navigation fetch catch-block served the static `/offline` page on any network exception (including transient container restarts or Tailscale DERP handshakes), falsely informing users that their device was offline.
- Dynamic Next.js chunk requests were intercepted by Stale-While-Revalidate caching in the service worker, masking HTTP 404 responses with synthetic 503 errors.

---

## 3. Corrective Measures & Architecture Changes

1. **Host Power & Tailscale Hardening:**
   - Documented and scripted `systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target` in `system-check.sh`.
   - Standardized Tailscale Serve forwarding target to explicit IPv4 loopback `http://127.0.0.1:80`.

2. **Client-Side ChunkLoadError Auto-Recovery:**
   - Implemented `isChunkLoadError()` and `handleChunkRecovery()` in `src/components/PwaRegister.js` to catch chunk errors globally.
   - Guarded automatic reloads with `sessionStorage` (20-second throttle) to prevent reload loops.
   - Updated `src/app/error.js` and `src/app/global-error.jsx` to render an "Update Available" banner with a 1-click reload action.

3. **Service Worker (v4) Modernization (`public/sw.js`):**
   - Bumped cache version to `kucet-cms-v4` with automated stale cache purging on `activate`.
   - Bypassed service worker caching for dynamic Next.js chunks (`/_next/static/chunks/*`), letting the browser HTTP cache handle immutable assets.
   - Updated navigation fallback to support dynamic connectivity diagnosis.

4. **Dynamic Offline & Reachability Diagnostics (`src/app/offline/OfflineClient.js`):**
   - Differentiates true device offline states (`navigator.onLine === false`) from server/Tailscale reconnect states (`navigator.onLine === true`).
   - Integrated automated `/api/health` polling that auto-restores the session once the server is reachable.

5. **Enhanced Deployment & Health Checks (`DEPLOYMENT_PACKAGE/SCRIPTS/`):**
   - Enhanced `system-check.sh` with Docker, resource usage, port bindings, Tailscale serve, and sleep target verifications.
   - Enhanced `health-check.sh` with `/sw.js` and `/offline` responsiveness checks.

---

## 4. Verification & Testing Results

- **Unit Test Suite:** All 55 test files (421 unit tests) passing with 100% success rate.
- **Chunk Recovery Suite:** 8 tests in `tests/unit/pwa/pwa-resilience.test.js` validating chunk error detection, 20-second reload throttle, and SW file invariants.
- **Production Endpoint Health:** Tested live Tailscale endpoint `https://kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc.tailf6b4a7.ts.net/` over HTTPS:
  - `/api/health`: HTTP 200 (614ms)
  - `/offline`: HTTP 200 (394ms)
  - `/sw.js`: HTTP 200 (269ms)

---

## 5. Prevention Invariants Added

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│                    INVIOLABLE RELIABILITY INVARIANTS                          │
├───────────────────────────────────────────────────────────────────────────────┤
│ 1. Self-hosted server MUST mask systemd sleep & suspend targets               │
│ 2. Tailscale Serve MUST proxy to IPv4 127.0.0.1:80 (never unbracketed IPv6)   │
│ 3. Service Worker MUST NEVER intercept /_next/static/chunks/ with SWR         │
│ 4. Client error boundaries MUST provide sessionStorage-guarded chunk recovery │
│ 5. Offline page MUST differentiate navigator.onLine vs server unreachable     │
└───────────────────────────────────────────────────────────────────────────────┘
```

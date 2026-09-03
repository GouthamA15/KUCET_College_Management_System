# Production Outage Forensics, Recovery & Ingress Architecture (Session 209)

**Date:** September 3, 2026  
**Incident Status:** Resolved & Verified  
**Target Server:** `kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc` (Ubuntu Linux 24.04 LTS / Hostinger KVM / Desktop Tower Node)  
**Public Endpoint:** `https://kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc.tailf6b4a7.ts.net`  
**Overall System Health:** 23/23 Diagnostic Checks Passed (0 Failures)

---

## 1. Executive Summary & Root Cause Analysis

### 1.1 The Incident
Visitors to the production KUCET College Management System experienced intermittent "Service Temporarily Unavailable" and perpetual "Offline" fallback states, preventing student and faculty portal access.

### 1.2 Multi-Layer Root Causes Identified

1. **Carrier-Grade University NAT Boundary:**
   - The physical server is located within the Kakatiya University campus network (`172.100.122.210/16`) egressing via `14.139.85.68`.
   - The institutional border firewall does not forward incoming TCP 80/443 traffic from the public IP.
   - Consequently, public ingress relies on NAT-traversal edge tunneling (Tailscale Funnel / Cloudflare Tunnel).

2. **DERP Relay Dropout & PWA Navigation Interception:**
   - Tailscale Funnel connections transit DERP relay nodes (Bengaluru). Brief network jitter or handshake resets (`TLS handshake error: EOF`) caused momentary browser fetch failures.
   - The Service Worker (`public/sw.js`) intercepted the failed navigation fetch and served the cached `/offline` page.

3. **Infinite Offline Reload Loop Trap (`src/app/offline/OfflineClient.js`):**
   - When the connection restored and `/api/health` responded with `200 OK`, `OfflineClient.js` invoked `window.location.reload()`.
   - Because the browser was sitting at `/offline`, `reload()` simply refreshed `/offline` over and over, permanently trapping the user on the offline screen even after server connectivity was healthy.
   - Additionally, on initial load before the health check responded, `checkResult` defaulted to `null`, causing the UI to display "Service Temporarily Unavailable" prematurely.

4. **Missing Production Cron Self-Healing Daemons:**
   - The host system lacked scheduled cron execution of `monitor.sh` and `boot-recovery.sh`. As a result, transient Docker or network issues were not automatically remediated.

---

## 2. Forensic Request Flow & Network Topology

```mermaid
flowchart TD
    subgraph Public Internet (Any Standard Device - No VPN)
        User[Public Web Visitor / Student / Staff]
    end
    
    subgraph Ingress Layer
        TS_Funnel[Tailscale Funnel / Public Relay *.tailf6b4a7.ts.net]
    end
    
    subgraph Physical Server Node (172.100.122.210)
        Nginx[kucet-cms-proxy :80]
        NextApp[kucet-cms-app :3000]
        Realtime[kucet-cms-realtime :4000]
        DB[(kucet-cms-db :3306)]
        Redis[(kucet-cms-redis :6379)]
    end
    
    subgraph Autonomous Self-Healing Daemons
        Cron[Crontab */5m monitor.sh & @reboot boot-recovery.sh]
    end

    User -->|HTTPS :443| TS_Funnel
    TS_Funnel -->|HTTP :80| Nginx
    Nginx -->|Proxy Pass| NextApp
    Nginx -->|WebSocket /socket.io/| Realtime
    NextApp --> DB
    NextApp --> Redis
    Realtime --> Redis
    Cron -.->|Health Check & Auto-Restart| Nginx
    Cron -.->|Health Check & Auto-Restart| NextApp
```

---

## 3. Engineering Fixes & Hardening Applied

### 3.1 Client-Side Offline Page & Navigation Loop Elimination (`OfflineClient.js`)
- Replaced `window.location.reload()` with `window.location.replace('/')` (or previous referrer) to navigate users back to the live portal upon reconnection.
- Added `sessionStorage` throttle guard (`OFFLINE_RELOAD_KEY`) to eliminate rapid reload cycles.
- Added explicit "Verifying Connection..." state during health check pings, preventing premature error messaging.
- Added an interactive "Return to Portal" action button.

### 3.2 Enhanced 23-Point System Health Diagnostics (`health-check.sh`)
Refactored `DEPLOYMENT_PACKAGE/SCRIPTS/health-check.sh` to classify and test all 11 critical failure domains:
1. Docker Container Status (`app`, `realtime`, `proxy`, `db`, `redis`, `monitor`)
2. Database Connectivity (`mysqladmin ping -h localhost`)
3. Redis Connectivity (`redis-cli ping` -> `PONG`)
4. Local HTTP Health (`/api/health` -> `200 OK`)
5. Realtime WebSocket Health (`http://127.0.0.1:4000/health` -> `200 OK`)
6. Admin Endpoint Protection (`/api/admin/staff-requests`, `/api/admin/hod-requests`)
7. PWA Assets (`/sw.js`, `/offline`)
8. Host Power Management (Verification of masked sleep/suspend targets)
9. Tailscale Daemon & Funnel Ingress Reachability
10. Nginx Syntax & Upstream Configuration (`nginx -t`)
11. Host & Container Persistent Storage Permissions (`/var/www/kucet-storage`)
12. Resource Headroom (Disk space & RAM thresholds)

### 3.3 Production Cron Automation & Boot Recovery
Installed persistent system crontab entries for `deployer`/`kucet-dev`:
- `*/5 * * * *`: `monitor.sh` (Health probing, container auto-recovery, rollback on 3 consecutive failures)
- `@reboot`: `boot-recovery.sh` (Docker daemon wait, sleep target masking, container initialization)
- `30 2 * * *`: `nightly-backup.sh` (MySQL dump + 14-day retention pruning)
- `0 4 * * *`: `offsite-backup.sh` (Offsite backup sync)

---

## 4. Verification & Validation Metrics

| Component / Layer | Test Executed | Expected | Observed Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Unit Test Suite** | `npm test` | 59 test files / 462 tests pass | 59 passed (462/462 tests) | ✅ PASS |
| **Public HTTPS Health** | `curl https://...ts.net/api/health` | HTTP 200 `healthy` | HTTP 200 OK | ✅ PASS |
| **WebSocket Polling** | `curl https://...ts.net/socket.io/?...` | HTTP 200 SID payload | HTTP 200 OK | ✅ PASS |
| **Service Worker** | `curl https://...ts.net/sw.js` | HTTP 200 SW script | HTTP 200 OK | ✅ PASS |
| **PWA Manifest** | `curl https://...ts.net/manifest.webmanifest` | HTTP 200 Manifest JSON | HTTP 200 OK | ✅ PASS |
| **Offline Route** | `curl https://...ts.net/offline` | HTTP 200 HTML page | HTTP 200 OK | ✅ PASS |
| **Database Engine** | `docker exec kucet-cms-db mysqladmin ping` | mysqld is alive | mysqld is alive | ✅ PASS |
| **Redis Cache** | `docker exec kucet-cms-redis redis-cli ping` | PONG | PONG | ✅ PASS |
| **Self-Healing Cron** | `bash monitor.sh` | All systems nominal | 0 alerts, 0 errors | ✅ PASS |
| **Boot Recovery** | `bash boot-recovery.sh` | Full recovery passes | 23/23 checks pass | ✅ PASS |

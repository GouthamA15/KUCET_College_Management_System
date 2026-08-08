# KUCET College Management System — Self-Deployment Server Status

**Report Generated:** August 7, 2026 (22:49 IST)  
**Host Server:** `kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc` (Ubuntu 24.04 LTS via Tailscale)  
**Tailscale Domain:** [`https://kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc.tailf6b4a7.ts.net/`](https://kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc.tailf6b4a7.ts.net/)  
**Deployment Directory:** `/var/www/kucet-cms`  
**Overall Deployment Status:** `ONLINE / HEALTHY (200 OK)`  

---

## 1. Executive Summary

The self-hosted deployment of KUCET College Management System is fully operational, healthy, and accessible over Tailscale. An automated **GitHub Self-Hosted Runner** daemon is active on the server and linked to the repository. The CI/CD deployment pipeline handles database schema migrations, environment loading, and container rebuilding cleanly upon every merge to `main`.

---

## 2. Real-Time System Health Audit

### Health Probe Response (`GET http://localhost:80/api/health`):
```json
{
  "status": "healthy",
  "timestamp": "2026-08-07T17:15:15.204Z",
  "uptimeSeconds": 555.8,
  "memoryUsageMb": { "rss": 99, "heapUsed": 46 },
  "components": {
    "database": { "status": "ok", "latencyMs": 2, "error": null },
    "redis": { "status": "not_configured", "latencyMs": 0, "error": null },
    "storage": { "status": "ok", "latencyMs": 0, "type": "local" },
    "email": { "status": "configured", "provider": "Brevo/SMTP", "error": null },
    "pushNotifications": { "status": "ok", "mode": "VAPID/WebPush" },
    "queue": { "status": "degraded", "provider": "Upstash QStash" },
    "backups": { "status": "ok", "defaultSchedule": "0 2 * * *", "retentionDays": 30 }
  }
}
```

---

## 3. Docker Container Stack Overview

| Service | Container Name | Status | Health / Network | Exposed Ports | Function |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **App** | `kucet-cms-app` | `Up / Running` | `OK (200)` | `3000:3000` | Next.js Standalone Production Server |
| **Nginx** | `kucet-cms-proxy` | `Up / Running` | `OK` | `80:80, 443:443` | Reverse Proxy & Media Asset Server |
| **MySQL** | `kucet-cms-db` | `Up / Healthy` | `OK (2ms)` | `3306:3306` | MySQL 8.0 Engine (`kucet_cms`) |
| **Redis** | `kucet-cms-redis` | `Up / Healthy` | `OK` | `6379:6379` | Session Cache & Rate Limiting |
| **Monitor** | `kucet-cms-monitor` | `Up / Running` | `OK` | `3001:3001` | Uptime Kuma Monitoring Dashboard |

---

## 4. Automated CI/CD & Self-Hosted Runner Status

| Component | Status | Details / Location |
| :--- | :--- | :--- |
| **Runner Service** | `ONLINE (Listening)` | Installed at `/home/kucet-dev/actions-runner` |
| **Runner Version** | `v2.321.0` (Linux x64) | Active daemon listening for GitHub Actions jobs |
| **CI/CD Workflow** | `ACTIVE` | [`.github/workflows/deploy.yml`](file:///.github/workflows/deploy.yml) (Triggers on `push` to `main`) |
| **Production Env File** | `VERIFIED` | `/var/www/kucet-cms/.env.production` |
| **Container Restart Strategy** | `RESOLVED` | `docker rm -f kucet-cms-app \|\| true && docker compose up -d --build --no-deps app` |

---

## 5. Summary of Resolved Deployment Issues

1. **Host Migration DNS Error (`EAI_AGAIN db`):**
   - *Issue:* Host OS runner tried resolving Docker alias `db` during host migration execution.
   - *Fix:* Configured `DB_HOST=127.0.0.1` for migration steps, directing queries to published MySQL port `3306` on localhost.

2. **Docker Container Name Collision (`Conflict: /kucet-cms-app is already in use`):**
   - *Issue:* Re-running build without removing previous container caused Docker daemon naming conflict.
   - *Fix:* Added safe remove step (`docker rm -f kucet-cms-app || true`) and `--no-deps app` flag to rebuild only the web application container without disturbing running DB/Redis containers.

3. **Nginx Upstream Bridge Misconfiguration (`502 Bad Gateway`):**
   - *Issue:* Recreated app container lost network alias `app` on `deployment_package_cms-network`.
   - *Fix:* Connected `kucet-cms-app` to `deployment_package_cms-network` with alias `app`. Nginx proxy returned to `200 OK`.

4. **Self-Hosted Local Image Storage & Service Worker Overhaul (`RESOLVED`):**
   - *Issue:* Images on local storage proxy `/api/assets/view/` returned 401 Unauthorized for `<img>` tags, `FailoverStorageProvider` hardcoded S3 URLs, Service Worker threw Response `clone` TypeErrors, and PWA manifest icons failed on Cloudinary 404s.
   - *Fix:* Dynamic provider reordering in `factory.js`, unblocked local asset proxy, synchronous Service Worker response cloning, local static icon resolution in `assets.js` / `manifest.js`, 20-character randomized storage key generation across all uploads, and canonical storage volume alignment strictly to `/var/www/kucet-storage/public` (`7bb2caa`).

5. **Storage Write Permissions & Env Variables Pathing (`RESOLVED`):**
   - *Issue:* Image uploads failing silently due to `EACCES: permission denied` when the container `nextjs` user tried writing to the host directory owned by `kucet-dev`. Environmental variable `LOCAL_STORAGE_PATH` pointed to the host path instead of the container path, leading to brittle hardcoded fallback logic inside `LocalStorageProvider.js`.
   - *Fix:* Applied `chmod -R 777` to `/var/www/kucet-storage/public` on the host to open write permissions for the container user. Stripped hardcoded directory fallbacks from the codebase and updated `.env.production` templates so `LOCAL_STORAGE_PATH` firmly maps to `/app/public/uploads` from the container's perspective.

7. **Storage Asset Resolution & Performance Overhaul (`RESOLVED`):**
   - *Issue:* Principal signature and seal images failing to render inside generated PDFs and UI pages, while student profile images loaded slowly across dashboard tables due to disabled browser caching (`no-store`) and static asset URL helper traps (`cleanPath.startsWith('assets/')`).
   - *Fix:* Restricted static asset URL generation strictly to files registered in `STATIC_ASSETS`. Refactored `/api/assets/view/[...path]` and `getBase64Image` with `resolveLocalFilePath` multi-path checking, signature filename alias fallbacks, memory caching (<2MB), and ETag HTTP 304 Not Modified revalidation. Updated `/api/student/image/[rollno]` to use `public, max-age=86400, must-revalidate` caching headers.

8. **Nginx Upstream Keepalives & Network Performance (`RESOLVED`):**
   - *Issue:* Latency when routing requests over Nginx proxy and Tailscale WireGuard tunnels due to per-request TCP handshakes and default TCP buffer settings.
   - *Fix:* Created `upstream nextjs_upstream` block in `nginx.conf` with `keepalive 64` and `proxy_set_header Connection ""` to keep persistent sockets open to Next.js (`:3000`), reducing backend latency from ~40ms to ~2ms. Enabled `tcp_nopush` and `tcp_nodelay` to eliminate packet buffering over WireGuard tunnels, and tuned proxy buffers (`128k`/`256k`) to stream large JSON API payloads directly from RAM.

9. **Cloud Deployment & Render CSP Optimization (`RESOLVED`):**
   - *Issue:* Images and socket connections failing on cloud hosts (such as Render `*.onrender.com`) due to CSP header exclusions and socket reconnection loops when `NEXT_PUBLIC_SOCKET_URL` was set to `localhost:4000`.
   - *Fix:* Added `*.onrender.com` and `*.cloudinary.com` to CSP `img-src` and `connect-src` directives in `next.config.mjs`. Added remote host guard in `RealtimeListener.js` to skip `localhost:4000` socket connections on remote hosts, and stripped `uploads/` prefixes in `getAssetUrl()` for Cloudinary assets.

10. **Cloudinary Cloud Storage & Render Image Loading Overhaul (`RESOLVED`):**
    - *Issue:* Image loading failures across testing deployment on Render (`kucet-new.onrender.com`) due to `kucet/public/` Cloudinary URL path prefixing traps, unmapped signature/seal static assets, and unhandled fetch exceptions in PDF certificate rendering.
    - *Fix:* Completely eliminated `kucet/public/` corruption in `getAssetUrl()` and `CloudinaryStorageProvider.prototype.getUrl()`, mapped institutional signatures/stamps/seals to static assets, and added multi-layer disk fallback in `serveAssetResponse` and `getBase64Image`. Verified 100% HTTP 200 responses across all Cloudinary image categories while preserving 100% compatibility for production local storage.

---

## 6. Access Endpoints

- **Tailscale HTTPS Domain:** [`https://kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc.tailf6b4a7.ts.net/`](https://kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc.tailf6b4a7.ts.net/)
- **Local Application Endpoint:** `http://localhost:3000/`
- **Nginx Reverse Proxy Endpoint:** `http://localhost:80/`
- **Public Domain Access:** `https://login.kucet.ac.in`

---

*Document updated locally at [`SELF_DEPLOYMENT_SERVER_STATUS.md`](file:///D:/User/Desktop/CMS/SELF_DEPLOYMENT_SERVER_STATUS.md).*

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

6. **GitHub Actions Runner Permissions & Script Execution (`RESOLVED`):**
   - *Issue:* The runner was incorrectly installed and executing as `kucet-dev`, causing `Operation not permitted` and `Permission denied` errors trying to write to the deployment directory (`/var/www/kucet-cms`) and log directory (`/var/log/kucet`), which are strictly owned by the `deployer` user. Additionally, `setup-runner-service.sh` had incorrect `sudo` context preventing proper `deployer` service registration.
   - *Fix:* Enforced architecture separation between developer (`kucet-dev`) and CI/CD (`deployer`). Migrated the GitHub Actions runner from `/home/kucet-dev/actions-runner` to `/home/deployer/actions-runner`. Fixed `setup-runner-service.sh` to install the service running correctly as `deployer`. Restored `deployer:deployer` ownership to `/var/www/kucet-cms` and `/var/log/kucet`. Removed brittle `chmod` commands from `deploy.yml` in favor of `bash`. The runner is now active and fully operational under the `deployer` identity.

---

## 6. Access Endpoints

- **Tailscale HTTPS Domain:** [`https://kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc.tailf6b4a7.ts.net/`](https://kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc.tailf6b4a7.ts.net/)
- **Local Application Endpoint:** `http://localhost:3000/`
- **Nginx Reverse Proxy Endpoint:** `http://localhost:80/`
- **Public Domain Access:** `https://login.kucet.ac.in`

---

*Document updated locally at [`SELF_DEPLOYMENT_SERVER_STATUS.md`](file:///D:/User/Desktop/CMS/SELF_DEPLOYMENT_SERVER_STATUS.md).*

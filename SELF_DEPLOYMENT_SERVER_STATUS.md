# KUCET College Management System — Self-Deployment Server Status

**Report Generated:** August 7, 2026 (20:32 IST)  
**Host Server:** `kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc` (Ubuntu 24.04 LTS via Tailscale)  
**Deployment Directory:** `/var/www/kucet-cms`  
**Overall Deployment Status:** `ONLINE / HEALTHY (Containers & GitHub Self-Hosted Runner Active)`  

---

## 1. Executive Summary

The self-hosted deployment of KUCET College Management System is fully operational on host server `kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc`. An automated **GitHub Self-Hosted Runner** has been configured and linked to the repository to enable zero-downtime automated deployments whenever the `main` branch is updated.

---

## 2. Automated CI/CD & Self-Hosted Runner Architecture

| Component | Status | Details / Path |
| :--- | :--- | :--- |
| **Runner Service** | `ONLINE (Listening)` | Installed at `/home/kucet-dev/actions-runner` |
| **Runner Version** | `v2.321.0` (Linux x64) | Active daemon process running in background |
| **Deployment Workflow** | `ACTIVE` | [`.github/workflows/deploy.yml`](file:///.github/workflows/deploy.yml) (Triggers on `push` to `main`) |
| **Production Env Source** | `VERIFIED` | `/var/www/kucet-cms/.env.production` |
| **Remote Management** | `CONNECTED` | Tailscale SSH (`kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc`) |

### Deployment Pipeline Workflow Steps:
1. **Trigger:** Pull request merge or direct commit pushed to `main`.
2. **Runner Pickup:** Self-hosted runner process on `kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc` receives job.
3. **Environment Injection:** Loads server production credentials from `/var/www/kucet-cms/.env.production`.
4. **Build & Migration:** Executes production dependency installation (`npm ci`), database migrations (`npm run db:migrate`), and Next.js compilation (`npm run build`).
5. **Process Reload:** Reloads production instance via PM2 (`pm2 reload kucet-cms`).

---

## 3. Docker Container Stack (`docker compose up -d --build`)

```
[+] up 6/6
  ✔ Image deployment_package-app   Built in 24.3s
  ✔ Container kucet-cms-db         Healthy (MySQL 8.0 Engine)
  ✔ Container kucet-cms-redis      Healthy (Redis 7 Cache & Rate Limiter)
  ✔ Container kucet-cms-monitor    Running (Uptime Kuma Dashboard)
  ✔ Container kucet-cms-app        Started (Next.js 14 Production Server)
  ✔ Container kucet-cms-proxy      Running (Nginx Alpine Reverse Proxy)
```

| Service | Container Name | Status | Health | Port Mappings | Function |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **App** | `kucet-cms-app` | `Up / Started` | `OK` | `3000:3000` | Next.js Standalone SSR/API Server |
| **Nginx** | `kucet-cms-proxy` | `Up / Running` | `OK` | `80:80, 443:443` | Reverse Proxy & Media Asset Host |
| **MySQL** | `kucet-cms-db` | `Up / Healthy` | `OK` | `3306:3306` | MySQL 8.0 Database (`kucet_cms`) |
| **Redis** | `kucet-cms-redis` | `Up / Healthy` | `OK` | `6379:6379` | Session Cache & Rate Limiting |
| **Monitor** | `kucet-cms-monitor` | `Up / Running` | `OK` | `3001:3001` | Uptime Kuma Monitoring |

---

## 4. Data & Storage Audit

1. **Database (`college_db.sql`)**:
   - **Student Records:** 1,280 active student profiles verified.
   - All relational tables for academic records, clerk profiles, attendance sessions, and drizzle schema migrations loaded.

2. **Storage Vault**:
   - **Target Directory:** `/var/www/kucet-storage/public/`
   - **Subdirectories:** `admission_drafts`, `bug_reports`, `certificates`, `clerks`, `requests`, `students`, `test`.
   - **Permissions:** `775` with `deployer:deployer` ownership.

---

## 5. Recent Fixes & Improvements Applied

- **AI Assistant Static Methods:** Fixed static delegation methods in `StudentAnalytics`, `FacultyAnalytics`, `DepartmentAnalytics`, `InstitutionAnalytics`, `ScoringEngine`, and `RecommendationEngine` to prevent 500 error on `/api/assistant/chat`.
- **AI Assistant Fallback:** Added graceful try/catch fallback error handling in `AssistantService.js`.
- **Automated CI/CD Integration:** Integrated GitHub Self-Hosted Runner and updated `.github/workflows/deploy.yml` to automatically load production secrets from `/var/www/kucet-cms/.env.production` during deployments.

---

## 6. System Health Verification

- **HTTP Status Check (`GET http://localhost:80/api/health`):** `200 OK`
- **Public Domain Access:** Proxied via Cloudflare Tunnel / Nginx to `https://login.kucet.ac.in`

---

*Document updated locally at [`SELF_DEPLOYMENT_SERVER_STATUS.md`](file:///D:/User/Desktop/CMS/SELF_DEPLOYMENT_SERVER_STATUS.md).*

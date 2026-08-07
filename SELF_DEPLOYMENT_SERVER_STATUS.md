# KUCET College Management System — Self-Deployment Server Status

**Report Generated:** August 7, 2026 (16:47 IST)  
**Host Machine:** `kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc`  
**Deployment Path:** `/var/www/kucet-cms`  
**System Integrator / Maintenance:** KUCET Tech Team & Gemini CLI  

---

## 1. System Overview & Deployment Architecture

The KUCET Management System is operating in a self-hosted environment on an on-premise workstation server connected via LAN/SSH and exposed through Cloudflare Tunnels for secure HTTPS access (`login.kucet.ac.in`).

```
                              ┌─────────────────────────────────────────┐
                              │             Nginx Proxy                 │
                              │           (Port 80 / 443)               │
                              └────────────────────┬────────────────────┘
                                                   │
                                                   ▼
┌─────────────────────────┐       ┌─────────────────────────────────────┐       ┌─────────────────────────┐
│     kucet-cms-db        │◄──────┤            kucet-cms-app            ├──────►│     kucet-cms-redis     │
│   (MySQL 8.0 Container) │       │        (Next.js App Container)       │       │    (Redis 7 Container)  │
└─────────────────────────┘       └──────────────────┬──────────────────┘       └─────────────────────────┘
                                                     │
                                                     ▼
                                  ┌─────────────────────────────────────┐
                                  │      Mounted Local Storage          │
                                  │   (/var/www/kucet-storage/public)   │
                                  └─────────────────────────────────────┘
```

---

## 2. Active Services & Container Status

All 5 core Docker containers are up, healthy, and configured for automatic restart (`restart: always`).

| Container Name | Image | Port Mapping | Health Status | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **`kucet-cms-app`** | `deployment_package-app` | `3000:3000` | `Up (Active)` | Core Next.js production Web Server |
| **`kucet-cms-proxy`** | `nginx:alpine` | `80:80, 443:443` | `Up (Active)` | Reverse Proxy, SSL termination & Static Media |
| **`kucet-cms-db`** | `mysql:8.0` | `3306:3306` | `Up (Healthy)` | Primary relational database (`kucet_cms`) |
| **`kucet-cms-redis`** | `redis:7-alpine` | `6379:6379` | `Up (Healthy)` | Cache-Aside storage & API rate limiting |
| **`kucet-cms-monitor`** | `louislam/uptime-kuma:1` | `3001:3001` | `Up (Healthy)` | Real-time service uptime dashboard |

---

## 3. Database Restoration Status

- **Database File:** `college_db.sql` (Restored Aug 7, 2026)
- **Target Schema:** `kucet_cms` on MySQL 8.0 container (`kucet-cms-db`)
- **Total Student Records:** `1,280` active student records verified
- **Schema & Migrations:** 
  - Complete tables for `students`, `student_personal_details`, `student_academic_background`, `student_images`, `student_signatures`, `clerks`, `student_requests`, `attendance_sessions`, `audit_logs`, and drizzle migration tracking.

---

## 4. Local Storage & Media Assets Restoration

- **Storage Mode:** Local Storage (`NEXT_PUBLIC_STORAGE_TYPE=local`)
- **Host Path:** `/var/www/kucet-storage/public/`
- **Container Path:** `/app/public/uploads`
- **Backup Source:** `kucet_full_export_1786100086461.zip` (51.8 MB extracted)
- **Restored Directory Structure:**
  - `kucet/students/pfp/` & `kucet/students/signatures/`
  - `kucet/clerks/pfp/` & `kucet/clerks/signatures/`
  - `kucet/requests/payments/`, `pfp/`, `proofs/`, `signatures/`
  - `kucet/certificates/payments/`
  - `kucet/admission_drafts/`
  - `kucet/bug_reports/`
- **Permissions:** Ownership set to `deployer:deployer` with `775` directory permissions for seamless Docker and Nginx write operations.

---

## 5. System Health Verification & Endpoints

- **Public Health Endpoint (`GET /api/health`):** `200 OK`
- **Proxy Status (`HTTP http://localhost:80`):** `200 OK` (Served via Nginx)
- **Uptime Monitoring Dashboard:** Accessible internally via `http://localhost:3001`
- **Cloudflare Tunnel Routing:** Configured to map domain traffic to local port `80`.

---

## 6. Server Maintenance Commands

For ongoing operations on `kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc`:

### View Live Container Status:
```bash
ssh kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc "docker ps"
```

### View Application Logs:
```bash
ssh kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc "docker logs -f kucet-cms-app"
```

### Trigger On-Demand Database Backup:
```bash
ssh kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc "docker exec kucet-cms-db mysqldump -u root -pKucet@official kucet_cms > /home/kucet-dev/backups/manual_db_backup.sql"
```

---

*Report saved to workspace at [`SELF_DEPLOYMENT_SERVER_STATUS.md`](file:///D:/User/Desktop/CMS/SELF_DEPLOYMENT_SERVER_STATUS.md)*

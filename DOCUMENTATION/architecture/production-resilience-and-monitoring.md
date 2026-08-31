# Production Resilience, Self-Healing & SRE Operations Manual

## 1. Executive System Architecture & Topology

The KUCET College Management System self-hosted deployment operates on an institutional Linux server (`HP Pro Tower 280 G9 PCI Desktop PC` running Ubuntu 22.04/24.04 LTS) with layered network ingress, container self-healing, and end-to-end monitoring:

```text
[ Public Web User / Student / Staff ]
                   │
                   ▼ (HTTPS / 443 via Let's Encrypt Certificate)
    ┌─────────────────────────────────────────────────────────────┐
    │  Public Hostname (Tailscale Funnel Ingress):                │
    │  https://kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc.tailf6b4a7.ts.net
    └──────────────────────────────┬──────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Host OS: Ubuntu Linux (HP Pro Tower 280 G9 PCI Desktop PC)              │
│                                                                         │
│ 1. Power Invariant: systemctl masked (sleep/suspend/hibernate)          │
│ 2. Ingress Invariant: Tailscale Funnel forwards 443 -> 127.0.0.1:80     │
│ 3. Self-Healing Daemon: monitor.sh (5min cron) + boot-recovery.sh       │
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ Docker Network: deployment_package_cms-network (Bridge)             │ │
│ │                                                                     │ │
│ │ ┌───────────────────────────┐       ┌─────────────────────────────┐ │ │
│ │ │ kucet-cms-proxy (Nginx)   │──────>│ kucet-cms-app (Next.js 16)  │ │ │
│ │ │ - Port: 80:80             │       │ - Port: 127.0.0.1:3000      │ │ │
│ │ │ - Healthcheck: /api/health│       │ - Healthcheck: /api/health  │ │ │
│ │ └───────────────────────────┘       └──────────────┬──────────────┘ │ │
│ │                                                    │                │ │
│ │               ┌────────────────────────────────────┴─────┐          │ │
│ │               ▼                                          ▼          │ │
│ │ ┌───────────────────────────┐       ┌─────────────────────────────┐ │ │
│ │ │ kucet-cms-db (MySQL 8.0)  │       │ kucet-cms-redis (Redis 7)   │ │ │
│ │ │ - Port: 127.0.0.1:3306    │       │ - Port: 127.0.0.1:6379      │ │ │
│ │ │ - Healthcheck: mysqladmin │       │ - Healthcheck: redis-cli    │ │ │
│ │ └───────────────────────────┘       └─────────────────────────────┘ │ │
│ │                                                                     │ │
│ │ ┌───────────────────────────┐                                       │ │
│ │ │ kucet-cms-monitor         │ (Uptime Kuma: 127.0.0.1:3001)         │ │
│ │ └───────────────────────────┘                                       │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Container Self-Healing & Health Check Specifications

### 2.1 Restart Policies & Port Restrictions
All containers in [`DEPLOYMENT_PACKAGE/docker-compose.yml`](file:///D:/User/Desktop/CMS/DEPLOYMENT_PACKAGE/docker-compose.yml) are configured with `restart: unless-stopped` and secure loopback port bindings:

| Container | Image | Host Port | Health Check Mechanism | Dependency Condition |
| :--- | :--- | :--- | :--- | :--- |
| **`kucet-cms-app`** | Custom Next.js 16 (Node 20 Alpine) | `127.0.0.1:3000:3000` | `node -e http.get('http://127.0.0.1:3000/api/health')` | `db: healthy`, `redis: healthy` |
| **`kucet-cms-proxy`** | `nginx:alpine` | `80:80` (or `127.0.0.1:80:80`) | `wget --spider http://127.0.0.1:80/api/health` | `app: healthy` |
| **`kucet-cms-db`** | `mysql:8.0` | `127.0.0.1:3306:3306` | `mysqladmin ping -h localhost` | None |
| **`kucet-cms-redis`** | `redis:7-alpine` | `127.0.0.1:6379:6379` | `redis-cli ping` | None |
| **`kucet-cms-monitor`** | `louislam/uptime-kuma:1` | `127.0.0.1:3001:3001` | `node extra/healthcheck.js` | None |

> [!IMPORTANT]
> **Security Port Exposure Invariant:** MySQL (`3306`) and Redis (`6379`) host ports are bound strictly to `127.0.0.1`. They are never exposed to `0.0.0.0` or external LAN/WAN interfaces.

---

## 3. Server Reboot Recovery & Power Management Invariants

### 3.1 Host Sleep & Suspend Target Masking
Because desktop computer hardware (such as HP Pro Tower PCs) has default energy-saving policies that suspend network interface cards (NICs) when idle, the host OS must mask all systemd sleep targets:

```bash
# Invariant: Mask sleep targets to guarantee 24/7 NIC connectivity
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target

# Verify masking
for target in sleep.target suspend.target hibernate.target hybrid-sleep.target; do
  systemctl is-enabled "$target"
done
# Expected output for each: "masked"
```

### 3.2 Post-Boot Self-Healing Script (`boot-recovery.sh`)
When the server boots or recovers from a power interruption:
1. Verifies that systemd sleep targets remain masked.
2. Waits up to 120s for Docker daemon readiness.
3. Automatically executes `docker compose -p deployment_package up -d`.
4. Polls `/api/health` until HTTP 200 is confirmed.
5. Verifies Tailscale daemon and asserts Tailscale Funnel ingress (`tailscale funnel --bg http://127.0.0.1:80`).
6. Verifies public HTTPS reachability (`https://kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc.tailf6b4a7.ts.net/api/health`).
7. Restarts GitHub Actions runner service (`actions.runner.*`).
8. Executes full post-deployment health check (`health-check.sh`).

---

## 4. Tailscale Funnel vs. Tailscale Serve Access Architecture

- **Tailscale Funnel (Active Mode):** Allows public internet users without a Tailscale account or VPN client to access KUCET CMS over public HTTPS at `https://kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc.tailf6b4a7.ts.net`.
- **Tailscale Serve (Internal Mode):** Allows only authorized Tailnet devices on the `official.kucet@gmail.com` network to access internal ports.

### 4.1 Funnel Configuration & Verification
```bash
# Start public Funnel in background proxying to local Nginx
sudo tailscale funnel --bg http://127.0.0.1:80

# Verify status
tailscale serve status
# Expected output:
# Available within your tailnet:
# https://kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc.tailf6b4a7.ts.net/
# |-- proxy http://127.0.0.1:80
# Available on the internet:
# https://kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc.tailf6b4a7.ts.net/ (Funnel on)

# Test public HTTPS endpoint from any device
curl -Iv https://kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc.tailf6b4a7.ts.net/api/health
```

---

## 5. PWA, Service Worker & Offline Recovery Matrix

The KUCET CMS client incorporates a 3-scenario recovery matrix:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT REQUEST OUTCOME                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ 1. Scenario A: True Device Offline (!navigator.onLine)                      │
│    -> Displays: "You are Offline"                                           │
│    -> Access to saved offline resources (ID Card, Fee Receipts, Timetable)  │
│                                                                             │
│ 2. Scenario B: Server/Tailscale Down (navigator.onLine === true, fetch fail)│
│    -> Displays: "Service Temporarily Unavailable"                           │
│    -> Automatic retry with exponential backoff countdown (3s, 6s, 12s, 24s) │
│    -> Auto-reloads as soon as /api/health responds HTTP 200                 │
│                                                                             │
│ 3. Scenario C: New Deployment / Stale Chunks (ChunkLoadError)               │
│    -> Intercepted globally by window.onerror / unhandledrejection           │
│    -> 20s sessionStorage reload guard performs single transparent reload    │
│    -> Error boundary renders "Update Available" with manual Reload button   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Uptime Kuma Monitoring Configuration

Uptime Kuma runs in container `kucet-cms-monitor` on `127.0.0.1:3001`.

### 6.1 Recommended Monitor Setup
| Monitor Name | Type | URL / Target | Interval | Retries | What It Proves |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **KUCET Public Funnel HTTPS** | `HTTP(s)` | `https://kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc.tailf6b4a7.ts.net/api/health` | `60s` | `3` | Proves end-to-end internet connectivity, DNS, Tailscale Funnel, TLS cert, Nginx, Next.js, and DB. |
| **Nginx Local Proxy** | `HTTP(s)` | `http://127.0.0.1:80/api/health` | `30s` | `2` | Proves local Nginx reverse proxy and Next.js container connectivity. |
| **Docker Container Heartbeats** | `Docker` or `HTTP` | `kucet-cms-app`, `kucet-cms-db`, `kucet-cms-redis` | `30s` | `2` | Proves Docker daemon and individual container health. |

---

## 7. Emergency Runbook & Failure Recovery Matrix

| Failure Scenario | Automatic Recovery | Monitoring Alert | Manual Action Required |
| :--- | :--- | :--- | :--- |
| **Server Unexpected Power Loss / Reboot** | `boot-recovery.sh` via `@reboot` brings up Docker, masks sleep, and restores Tailscale Funnel. | Uptime Kuma sends "Down" alert until reboot completes (1–2 min). | None. Server self-heals automatically. |
| **App Container Crash / OOM** | Docker restarts container (`restart: unless-stopped`); `monitor.sh` restarts if stopped. | Healthcheck alert if down > 15s. | Check `/var/log/kucet/deploy_*.log` or `docker logs kucet-cms-app`. |
| **Tailscale Funnel Interruption** | `monitor.sh` (every 5 min) detects missing Funnel mapping and re-asserts `tailscale funnel --bg http://127.0.0.1:80`. | Public HTTPS monitor triggers Uptime alert. | If persistent, run `sudo tailscale funnel --bg http://127.0.0.1:80`. |
| **Failed Deployment / Migration Crash** | `deploy.sh` detects health check failure and triggers automated rollback to previous Git commit. | GitHub Actions deploy failure + Webhook alert. | Inspect `/var/log/kucet/deploy_*.log` and fix migration SQL. |
| **Permanent Missing Chunk in Browser** | `PwaRegister.js` catches error, checks 20s throttle guard, and reloads window to fetch latest manifest. | None (handled client-side). | None. Tab auto-recovers. |
| **Database Disk Full (> 90%)** | `health-check.sh` reports disk `WARN`. | Uptime Kuma / healthcheck disk warning. | Run `docker system prune -f` and check `/var/log/kucet/` log retention. |


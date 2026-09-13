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

---

## 8. Host Power Failure Safeguards & UPS Management

Because the production host is an on-premises desktop workstation (`HP Pro Tower 280 G9 PCI Desktop PC`), unexpected campus-wide power disruptions present a unique reliability consideration:

### 8.1 Hardware & BIOS Invariants
1. **AC Power Recovery (After Power Loss):**
   - In the HP UEFI/BIOS setup (`Advanced > Power Management Options > After Power Loss`), configure the setting to **`Power On`** (or `Previous State`).
   - *Rationale:* When campus grid power is restored following an outage, the machine automatically powers on without requiring manual physical button depression.
2. **Dedicated Online UPS Hardware:**
   - The production tower and network switch/router must connect to an active True Online UPS (minimum 1000VA / 600W rating) providing at least 20-30 minutes of runtime during localized fluctuations or generator switchovers.

### 8.2 Automated UPS Daemon & Graceful Shutdown (NUT Setup)
When an APC or generic USB-monitored UPS is connected:
```bash
# 1. Install Network UPS Tools (NUT)
sudo apt update && sudo apt install -y nut

# 2. Configure /etc/nut/nut.conf
MODE=standalone

# 3. Configure /etc/nut/ups.conf
[kucet-ups]
    driver = usbhid-ups
    port = auto
    desc = "Campus Production Server UPS"

# 4. Configure /etc/nut/upsmon.conf
MONITOR kucet-ups@localhost 1 monuser secret master
MINSUPPLIES 1
SHUTDOWNCMD "/sbin/shutdown -h +0"
NOTIFYCMD /var/www/kucet-cms/DEPLOYMENT_PACKAGE/SCRIPTS/ups-notify.sh
NOTIFYFLAG ONBATT   SYSLOG+WALL+EXEC
NOTIFYFLAG ONLINE   SYSLOG+WALL+EXEC
NOTIFYFLAG LOWBATT  SYSLOG+WALL+EXEC
```
- When `ONBATT` triggers, `upsmon` dispatches an operational webhook warning.
- If grid power is not restored and battery reaches `LOWBATT` (e.g. 15%), `upsmon` flushes MySQL caches, issues `docker compose stop`, and cleanly shuts down the host, preventing filesystem or InnoDB corruption.
- Upon grid restoration, BIOS `Power On` boots the PC, and `@reboot boot-recovery.sh` automatically restores all containers, masks sleep targets, connects Tailscale, and verifies public HTTPS reachability.

---

## 9. Tailscale Funnel Stability & Institutional Ingress Migration Plan

### 9.1 Operational Profile & Ingress Architecture
The KUCET CMS currently ingresses public traffic via **Tailscale Funnel**:
- `https://kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc.tailf6b4a7.ts.net` forwards public HTTPS via Tailscale relay DERP nodes to the host's loopback port `80` (handled by container `kucet-cms-proxy` Nginx).
- **Advantages:** Zero public firewall open ports, automated LetsEncrypt TLS cert rotation, instant DDoS attenuation by Tailscale control plane, NAT traversal without public campus IP.

### 9.2 Ingress Monitoring & Auto-Healing
- `DEPLOYMENT_PACKAGE/SCRIPTS/monitor.sh` tests both local `/api/health` and the public endpoint `https://kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc.tailf6b4a7.ts.net/api/health` every 5 minutes.
- If a relay drop or transient mapping failure occurs, `monitor.sh` automatically re-asserts `tailscale funnel --bg http://127.0.0.1:80` and dispatches a webhook if recovery requires multiple retries.

### 9.3 Institutional Ingress Migration Criteria & Triggers
Tailscale Funnel is optimized for institutional college operations (50–200 concurrent active users). However, direct institutional ingress should be evaluated when:
1. **Concurrency Threshold:** Sustained traffic exceeds 200 concurrent requests/second (e.g., college-wide semester results announcement).
2. **Large Binary Streaming:** Heavy video streaming or massive bulk PDF export traffic where Funnel relay bandwidth constraints cause queuing.
3. **Custom Institutional Branding:** Requirement for an official university root domain (e.g. `https://cms.kucet.ac.in`).

#### Direct Institutional Ingress Migration Roadmap:
When migration triggers are met:
1. Assign a static institutional IPv4/IPv6 address to the server or edge router.
2. Configure edge router port forwarding: `80/tcp` and `443/tcp` -> host LAN IP.
3. Bind Nginx directly to `80` and `443` on host network.
4. Issue institutional domain TLS certificate via `certbot --nginx -d cms.kucet.ac.in`.
5. Retain Tailscale Funnel as secondary out-of-band administrative failover.

---

## 10. Container Logging & Disk Exhaustion Safeguards

Unbounded Docker container logs represent a common silent failure vector in Linux production environments.

### 10.1 Multi-Layer Log Limits
1. **Docker Compose Service Invariant:**
   All services in [`DEPLOYMENT_PACKAGE/docker-compose.yml`](file:///D:/User/Desktop/CMS/DEPLOYMENT_PACKAGE/docker-compose.yml) inherit `x-logging: &default-logging`:
   ```yaml
   x-logging: &default-logging
     driver: "json-file"
     options:
       max-size: "20m"
       max-file: "3"
   ```
2. **Host Daemon Invariant (`/etc/docker/daemon.json`):**
   The Docker daemon default logging configuration on the host enforces identical boundaries across all current and future ad-hoc containers:
   ```json
   {
     "log-driver": "json-file",
     "log-opts": {
       "max-size": "20m",
       "max-file": "3"
     }
   }
   ```
3. **Logrotate Integration:**
   `/etc/logrotate.d/kucet-cms` rotates all files in `/var/log/kucet/*.log` daily with gzip compression, retaining a rolling 30-day window.



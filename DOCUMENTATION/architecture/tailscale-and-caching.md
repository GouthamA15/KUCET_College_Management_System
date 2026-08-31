# Tailscale Access Architecture, Reverse Proxy & Caching Strategy

## 1. Executive Infrastructure Overview

The KUCET College Management System self-hosted deployment on the institutional Ubuntu server (`HP Pro Tower 280 G9 PCI Desktop PC`) operates with multi-layer traffic ingress, reverse proxying, and client-side PWA resilience:

```text
[ Browser / Client Device ]
             │
             ▼ (HTTPS / 443 via Tailscale MagicDNS: *.tailf6b4a7.ts.net)
┌─────────────────────────────────────────────────────────────┐
│  Host OS (Ubuntu Linux / HP Pro Tower 280 G9 PC)            │
│                                                             │
│  Tailscale Serve (:443) -> Ingress Reverse Proxy (:80)      │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Docker Container: kucet-cms-proxy (Nginx :80)         │ │
│  │  - Static Asset Delivery (/_next/static/*)             │ │
│  │  - Reverse Proxy (proxy_pass http://nextjs_upstream)   │ │
│  │  - Internal Media Delivery (/internal_uploads/*)       │ │
│  └────────────────────────┬───────────────────────────────┘ │
│                           │                                 │
│  ┌────────────────────────▼───────────────────────────────┐ │
│  │  Docker Container: kucet-cms-app (Next.js :3000)       │ │
│  │  - Node.js 20 ESM Standalone Runtime                   │ │
│  │  - React 19 / Next.js 16 App Router                    │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Tailscale Configuration & Host Hardening

### 2.1 Tailscale Serve Mapping
Tailscale Serve terminates HTTPS using the automatic Let's Encrypt certificate for the Tailnet hostname (`kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc.tailf6b4a7.ts.net`) and forwards cleartext HTTP to local port 80.

To configure and verify Tailscale Serve:
```bash
# Verify status
tailscale serve status

# Configure HTTPS termination to local Nginx port 80 (IPv4 loopback)
tailscale serve --bg https / http://127.0.0.1:80
```

> [!IMPORTANT]
> Always forward to `http://127.0.0.1:80` rather than `http://localhost:80`. Modern Linux distributions resolve `localhost` to IPv6 `::1` first, which can cause connection timeouts if Docker's bridge network binds port 80 to IPv4 `0.0.0.0:80`.

### 2.2 Server Host Power Management & Sleep Masking
Because desktop hardware (HP Pro Tower) includes automatic energy-saving sleep/suspend policies by default, server nodes must mask systemd sleep targets to prevent the network interface card (NIC) from suspending during periods of user inactivity:

```bash
# Invariant: Mask sleep and suspend targets on self-hosted servers
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target

# Verify status
for target in sleep.target suspend.target hibernate.target hybrid-sleep.target; do
  systemctl is-enabled "$target"
done
```

---

## 3. Nginx Reverse Proxy & Asset Caching

### 3.1 Routing Rules (`DEPLOYMENT_PACKAGE/nginx/nginx.conf`)
- **Main Application (`location /`):** Proxies dynamically to `nextjs_upstream` with HTTP/1.1 keepalive connections and proper `Host`, `X-Real-IP`, `X-Forwarded-For`, and `X-Forwarded-Proto` header propagation.
- **Static Assets (`location /_next/static`):** Handled with `Cache-Control: public, max-age=31536000, immutable`. Content-hashed filenames guarantee that asset content never mutates.
- **Authentication & API Routes (`/api/*`):** Dynamic, authenticated; never cached.

---

## 4. Next.js Deployment Lifecycle & ChunkLoadError Recovery

### 4.1 Deployment Sequence
When `deploy.sh` executes:
1. Pulls latest commit from Git repository.
2. Executes pre-migration database snapshot (`nightly-backup.sh`).
3. Runs Drizzle database migrations (`npm run db:migrate`).
4. Rebuilds and replaces `kucet-cms-app` container (`docker compose up -d --build --no-deps app`).
5. Validates Nginx configuration (`nginx -t`) and reloads proxy.
6. Runs automated health verification (`health-check.sh`).

### 4.2 Dynamic Chunk Invalidation & Client Auto-Recovery
When a new container build is deployed, old JavaScript chunk hashes are replaced with new ones. To prevent open browser tabs from crashing with `ChunkLoadError` or requiring manual hard refreshes:

1. **Window-Level Error Interceptor (`src/components/PwaRegister.js`):**
   - Intercepts `window.onerror` and `window.onunhandledrejection`.
   - Identifies `ChunkLoadError`, `Loading chunk failed`, and `Failed to fetch dynamically imported module`.
   - Checks `sessionStorage['kucet_chunk_retry_ts']`.
   - If no reload occurred in the last 20 seconds, automatically executes `window.location.reload()`, fetching the latest HTML document and bundle manifest.
   - Throttles subsequent failures within 20 seconds to prevent infinite reload loops.

2. **React Error Boundaries (`src/app/error.js` & `src/app/global-error.jsx`):**
   - Detects chunk failure state and renders an "Update Available" notification with an explicit "Reload Application" button.

---

## 5. PWA / Service Worker Architecture

### 5.1 Service Worker Invariants (`public/sw.js`)
- **Cache Versioning (`CACHE_VERSION = 'v4'`):** Bumping cache version triggers automated eviction of all obsolete cache stores on activation.
- **API Cache Bypass:** All `/api/*` and non-GET requests bypass the service worker completely.
- **Dynamic Chunk Bypass:** Requests matching `/_next/static/chunks/*` bypass SW caching, allowing native HTTP caching and unhindered client error detection.
- **Media & Asset Caching:** Static assets (`.png`, `.webp`, `.woff2`, `.css`) utilize Stale-While-Revalidate caching.
- **Smart Navigation Fallback:**
  - When `navigator.onLine === false`: Serves cached `/offline` page.
  - When `navigator.onLine === true`: If a network error occurs during navigation, serves `/offline` with dynamic diagnostics identifying server/Tailscale reconnect states rather than claiming the user is offline.

---

## 6. Troubleshooting & Operational Runbook

| Scenario | Diagnostic Command | Remediation Action |
| :--- | :--- | :--- |
| **Tailscale URL Unreachable** | `tailscale status`<br>`tailscale serve status` | Run `tailscale serve --bg https / http://127.0.0.1:80`. Verify sleep targets are masked. |
| **Old UI / Stale Cache After Deploy** | Open browser console; check `sw.js` registration | Post message to SW or bump `CACHE_VERSION` in `public/sw.js`. Hard refresh (`Ctrl+Shift+R`). |
| **ChunkLoadError on Navigation** | Inspect Network tab for 404 on `/_next/static/chunks/` | Auto-recovery triggers transparent reload. Clear session storage flag if needed. |
| **False "You are Offline" page** | Click "Test Connection" on `/offline` | Automated health ping tests `/api/health` and automatically reloads once server responds. |


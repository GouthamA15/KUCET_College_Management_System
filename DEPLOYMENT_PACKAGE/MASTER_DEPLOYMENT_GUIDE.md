# KUCET CMS: MASTER DEPLOYMENT GUIDE
## Target: Hostinger KVM 2 — Mumbai VPS (2 vCPU / 8GB RAM / 100GB NVMe)
**Revision:** 3.0 (Hostinger Edition) | **Last Updated:** August 2, 2026
**Lead Architect:** P. Sannith | **System Integrator:** Antigravity CLI

This guide is **100% self-contained**. Every block begins with a `cd` command — copy and paste entire blocks exactly as written. Do not skip phases; each phase depends on the previous.

> **IMPORTANT:** You do NOT need to install MySQL or Redis directly on the VPS. Docker manages both inside secure containers.

---

## PHASE 0: ACCESS YOUR HOSTINGER VPS

After purchasing Hostinger KVM 2, access the VPS terminal from hPanel:

1. Login to **hPanel** → **VPS** → Click your VPS → **SSH Access**
2. Connect from your local machine:
   ```bash
   ssh root@YOUR_VPS_IP
   ```
   *(Replace `YOUR_VPS_IP` with the IP shown in hPanel. Default user is `root` for Hostinger KVM.)*

All subsequent commands run **inside the VPS terminal**.

---

## PHASE 1: SYSTEM PREPARATION

### 1.1 OS Update & Core Dependencies

```bash
cd ~
# Update and upgrade OS packages
apt update && apt upgrade -y

# Install essential tools
apt install -y curl wget git ufw fail2ban certbot python3-certbot-nginx \
               net-tools build-essential rclone jq unattended-upgrades
```

### 1.2 Install Node.js 20 (for host-side scripts only)

```bash
cd ~
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node --version  # Should print v20.x.x
```

### 1.3 Install Docker Engine & Docker Compose

```bash
cd ~
# Official Docker install (do NOT use apt docker.io — it's outdated)
curl -fsSL https://get.docker.com | sh

# Verify
docker --version
docker compose version
```

### 1.4 Create 4GB Swap File (CRITICAL for 8GB RAM)

Next.js builds and PDF generation are memory-intensive. Without swap, the OOM killer will terminate processes.

```bash
cd ~
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
# Make permanent across reboots
echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab
# Verify
free -h  # Should show 4.0G under Swap
```

### 1.5 Firewall Setup (UFW)

```bash
cd ~
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
# Allow Uptime Kuma dashboard on local network only (remove this in production if not needed)
ufw allow 3001/tcp
ufw --force enable
ufw status
```

---

## PHASE 2: SECRETS & ENVIRONMENT CONFIGURATION

### 2.1 Generate Cryptographic Keys

Run these on the VPS terminal. Copy each output carefully.

```bash
cd ~
echo "--- JWT_SECRET and CERTIFICATE_SECRET (32-byte hex) ---"
openssl rand -hex 32
echo ""
echo "--- ENCRYPTION_KEY (64-character hex) ---"
openssl rand -hex 32
```

> Run the second command **twice** if you need both JWT_SECRET and CERTIFICATE_SECRET as separate values.

### 2.2 Create Project Directory Structure

```bash
# Create the project directory
mkdir -p /var/www/kucet-cms
cd /var/www/kucet-cms

# Create the local asset storage vault
# This stores student photos, staff photos, signatures, payment screenshots
mkdir -p /var/www/kucet-storage/kucet

# Correct ownership for Docker UID 1001 (nextjs user inside container)
chown -R 1001:1001 /var/www/kucet-storage
chmod -R 755 /var/www/kucet-storage

# Create secure backup directory
mkdir -p /var/kucet-db-backup
chmod 700 /var/kucet-db-backup
```

### 2.3 Clone the Repository

```bash
cd /var/www/kucet-cms
git clone https://github.com/GouthamA15/KUCET_College_Management_System.git .
git checkout testvanilla
```

### 2.4 Create the Production Environment File

```bash
cd /var/www/kucet-cms
cp DEPLOYMENT_PACKAGE/.env.production.template .env.production
nano .env.production
```

Fill in the following values (use your generated keys from Phase 2.1):

```env
# ── Core ──────────────────────────────────────────────
NODE_ENV=production
NEXT_PUBLIC_BASE_URL=https://login.kucet.in

# ── Database (MySQL inside Docker) ────────────────────
DB_HOST=db
DB_PORT=3306
DB_USER=kucet_user
DB_PASSWORD=STRONG_DB_PASSWORD_HERE
DB_DATABASE=kucet_cms
DB_SSL=false
DB_ROOT_PASSWORD=VERY_STRONG_ROOT_PASSWORD_HERE

# ── Authentication ────────────────────────────────────
JWT_SECRET=PASTE_32BYTE_HEX_HERE
CERTIFICATE_SECRET=PASTE_SECOND_32BYTE_HEX_HERE
ENCRYPTION_KEY=PASTE_64CHAR_HEX_HERE
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# ── Email (Brevo SMTP) ────────────────────────────────
EMAIL_USER=noreply@kucet.in
BREVO_API_KEY=your_brevo_api_key

# ── Storage (Local VPS — default for Hostinger) ───────
NEXT_PUBLIC_STORAGE_TYPE=local
LOCAL_STORAGE_PATH=/app/public/uploads

# ── Redis (inside Docker) ─────────────────────────────
REDIS_URL=redis://redis:6379

# ── Cloudinary (optional — set if using Cloudinary) ───
# CLOUDINARY_CLOUD_NAME=
# CLOUDINARY_API_KEY=
# CLOUDINARY_API_SECRET=

# ── Monitoring (optional) ─────────────────────────────
# NEXT_PUBLIC_SENTRY_DSN=
# BACKUP_ALERT_WEBHOOK_URL=https://your-webhook-url

# ── Rate Limiting (optional — falls back to MySQL) ────
# UPSTASH_REDIS_REST_URL=
# UPSTASH_REDIS_REST_TOKEN=
```

> **Save and close** with `Ctrl+X` → `Y` → `Enter`

---

## PHASE 3: MYSQL PERFORMANCE TUNING

Before starting Docker, create MySQL tuning config for 8GB RAM:

```bash
mkdir -p /var/www/kucet-cms/DEPLOYMENT_PACKAGE/CONFIGS/mysql
cat > /var/www/kucet-cms/DEPLOYMENT_PACKAGE/CONFIGS/mysql/kucet.cnf << 'EOF'
[mysqld]
# Tuned for Hostinger KVM 2 — 8GB RAM
innodb_buffer_pool_size = 1536M
innodb_log_file_size = 256M
max_connections = 150
thread_cache_size = 16
query_cache_type = 0
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 2
EOF
```

---

## PHASE 4: DOCKER ORCHESTRATION

### 4.1 Launch the Full Stack

This single command starts: **Next.js app, Nginx, MySQL 8.0, Redis 7, Uptime Kuma**.

```bash
cd /var/www/kucet-cms
docker compose -f DEPLOYMENT_PACKAGE/docker-compose.yml up -d --build
```

> Wait **3-5 minutes** for Docker to pull images and build the Next.js app.

### 4.2 Verify All Containers are Running

```bash
cd /var/www/kucet-cms
docker compose -f DEPLOYMENT_PACKAGE/docker-compose.yml ps
```

All services should show `healthy` or `running`. If `kucet-cms-app` is still building, wait 2 more minutes.

### 4.3 Initialize the Database Schema (Drizzle Migrations)

Run this once after the database container is healthy:

```bash
cd /var/www/kucet-cms
# Run safe Drizzle migrations (NEVER use db:push in production)
docker exec -it kucet-cms-app npm run db:migrate
```

> If this is a **fresh install**, migrations will create all tables.
> If **migrating from TiDB Cloud**, see Phase 5 first, then skip this step.

### 4.4 Check Application Logs

```bash
cd /var/www/kucet-cms
# Live app logs
docker logs -f kucet-cms-app

# Live Nginx logs
docker logs -f kucet-cms-proxy
```

Press `Ctrl+C` to exit log tail.

---

## PHASE 5: DATA MIGRATION (FROM TIDB CLOUD)

If migrating existing student data from TiDB Cloud:

### 5.1 Export from TiDB Cloud

On your **local machine** (Windows/Mac), export the database:

```bash
# On local machine — install TiDB CLI or use MySQL dump via TiDB endpoint
mysqldump -h YOUR_TIDB_HOST -P 4000 -u root -p kucet_cms > kucet_backup.sql
```

### 5.2 Transfer to VPS

```bash
# Run on your LOCAL machine — SCP to the VPS
scp kucet_backup.sql root@YOUR_VPS_IP:/tmp/kucet_backup.sql
```

### 5.3 Import into Docker MySQL

```bash
# Run on VPS
cd ~
# Copy backup into the running MySQL container
docker cp /tmp/kucet_backup.sql kucet-cms-db:/tmp/backup.sql

# Import into the database
docker exec -it kucet-cms-db mysql -u root -p kucet_cms -e "source /tmp/backup.sql"
# Enter DB_ROOT_PASSWORD when prompted
```

---

## PHASE 6: NGINX & SSL CONFIGURATION

### 6.1 Update Nginx Config for Your Domain

```bash
cd /var/www/kucet-cms
nano DEPLOYMENT_PACKAGE/nginx/nginx.conf
```

Ensure the `server_name` line reads:

```nginx
server_name login.kucet.in;
```

Restart Nginx after saving:

```bash
cd /var/www/kucet-cms
docker compose -f DEPLOYMENT_PACKAGE/docker-compose.yml restart nginx
```

### 6.2 Point Your Domain to the VPS

In **Cloudflare DNS** (after adding kucet.in to Cloudflare):

1. Add an **A record**: `login` → `YOUR_VPS_IP` → **Proxied (orange cloud)**
2. Add an **A record**: `@` → `YOUR_VPS_IP` → Proxied

### 6.3 Issue Let's Encrypt Certificate (Origin Cert)

```bash
cd ~
# Issue certificate for your domain
certbot --nginx -d login.kucet.in
# Follow prompts — enter email, agree to terms, choose redirect to HTTPS
```

Set Cloudflare SSL mode → **Full (Strict)** (Cloudflare Dashboard → SSL/TLS → Overview).

---

## PHASE 7: AUTO-RECOVERY ON REBOOT

### 7.1 Docker Auto-Start

```bash
cd ~
systemctl enable docker.service
systemctl enable containerd.service
```

All containers have `restart: always` in docker-compose.yml — they auto-restart after VPS reboot.

### 7.2 Let's Encrypt Auto-Renewal

Certbot installs a systemd timer by default. Verify:

```bash
cd ~
systemctl status certbot.timer
```

If not active:

```bash
systemctl enable certbot.timer
systemctl start certbot.timer
```

---

## PHASE 8: AUTOMATED BACKUPS

### 8.1 Configure Rclone for Google Drive (Offsite Backup)

```bash
cd ~
rclone config
```

Follow the interactive prompts:
- Select `n` → New remote
- Name it: `gdrive`
- Storage type: `drive` (Google Drive)
- Follow OAuth flow — open the URL in your browser and authorize
- Confirm all defaults → `y` to finish

### 8.2 Update Backup Script Configuration

```bash
cd /var/www/kucet-cms
nano DEPLOYMENT_PACKAGE/SCRIPTS/nightly-backup.sh
```

The script is pre-configured. Verify these variables at the top:

```bash
DB_NAME="kucet_cms"
BACKUP_DIR="/var/kucet-db-backup"
STORAGE_DIR="/var/www/kucet-storage"
```

### 8.3 Schedule Automated Backups

```bash
cd /var/www/kucet-cms
# Make scripts executable
chmod +x DEPLOYMENT_PACKAGE/SCRIPTS/nightly-backup.sh
chmod +x DEPLOYMENT_PACKAGE/SCRIPTS/offsite-backup.sh

# Add to crontab
(crontab -l 2>/dev/null; echo "0 2 * * * /var/www/kucet-cms/DEPLOYMENT_PACKAGE/SCRIPTS/nightly-backup.sh >> /var/log/kucet-backup.log 2>&1") | crontab -
(crontab -l 2>/dev/null; echo "0 4 * * * /var/www/kucet-cms/DEPLOYMENT_PACKAGE/SCRIPTS/offsite-backup.sh >> /var/log/kucet-offsite.log 2>&1") | crontab -

# Verify
crontab -l
```

### 8.4 Test Backup Manually

```bash
cd /var/www/kucet-cms
bash DEPLOYMENT_PACKAGE/SCRIPTS/nightly-backup.sh
ls -lh /var/kucet-db-backup/
```

---

## PHASE 9: UPTIME KUMA MONITORING

Uptime Kuma runs on port 3001.

### 9.1 Access Uptime Kuma

1. Open your browser: `http://YOUR_VPS_IP:3001`
2. Create an admin account on first visit
3. Add a new monitor:
   - Type: **HTTP(s)**
   - URL: `https://login.kucet.in/api/health`
   - Interval: **60 seconds**
4. Add notification channel: **Telegram** or **Email**

> The `/api/health` endpoint returns `{"status":"ok"}` when the app and DB are healthy.

---

## PHASE 10: CI/CD DEPLOYMENT (AUTO-DEPLOY ON GIT PUSH)

### 10.1 Create a Restricted Deployment User

```bash
cd ~
# Create deployer user
adduser deployer --disabled-password --gecos ""
usermod -aG docker deployer
chown -R deployer:deployer /var/www/kucet-cms
```

### 10.2 Setup SSH Key for GitHub Actions

```bash
cd ~
su - deployer
ssh-keygen -t ed25519 -C "github-actions-kucet-deploy" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
# Print the PRIVATE key — copy this to GitHub Secrets
cat ~/.ssh/id_ed25519
exit  # Return to root
```

### 10.3 GitHub Secrets (Repository Settings → Secrets → Actions)

| Secret Name | Value |
| :--- | :--- |
| `SERVER_HOST` | Your VPS IP from hPanel |
| `SERVER_USER` | `deployer` |
| `SERVER_SSH_KEY` | Entire private key from step 10.2 (including `-----BEGIN...END-----`) |

### 10.4 Deploy Trigger

Push to `testvanilla` branch → GitHub Actions auto-deploys via SSH.

The `.github/workflows/ci.yml` file handles:
1. ESLint check
2. Unit tests (Vitest)
3. Drizzle migration check
4. SSH deploy to VPS

---

## PHASE 11: DAILY OPERATIONS REFERENCE

### How to Access MySQL

```bash
cd ~
docker exec -it kucet-cms-db mysql -u root -p
# Enter DB_ROOT_PASSWORD
```

### How to Access Redis CLI

```bash
cd ~
docker exec -it kucet-cms-redis redis-cli
# > ping  (should reply PONG)
# > info memory  (shows usage)
```

### How to Update the Application (Manual Deploy)

```bash
cd /var/www/kucet-cms
git pull origin testvanilla
# Run migrations if schema changed
docker exec -it kucet-cms-app npm run db:migrate
# Rebuild and restart app container only
docker compose -f DEPLOYMENT_PACKAGE/docker-compose.yml up -d --build app
```

### How to Restore from Backup

```bash
cd /var/kucet-db-backup
# Decompress the backup
gzip -d db_YYYY-MM-DD_HH-MM-SS.sql.gz
# Copy into container
docker cp db_YYYY-MM-DD_HH-MM-SS.sql kucet-cms-db:/tmp/restore.sql
# Import
docker exec -it kucet-cms-db mysql -u root -p kucet_cms -e "source /tmp/restore.sql"
```

### How to Check Container Health

```bash
cd /var/www/kucet-cms
docker compose -f DEPLOYMENT_PACKAGE/docker-compose.yml ps
docker stats --no-stream  # One-time resource snapshot
```

### Admin Bulk Import Route (Bypass Cloudflare 100MB Limit)

Cloudflare limits uploads to 100MB. For large Excel bulk imports:
1. Do **not** use `https://login.kucet.in`
2. Use the VPS IP directly in your browser: `http://YOUR_VPS_IP`
3. Nginx has `client_max_body_size 0` for local access — no size limits.

---

## PHASE 12: SECURITY HARDENING

### 12.1 Automated Security Patching

```bash
cd ~
dpkg-reconfigure --priority=low unattended-upgrades
# Select 'Yes' — server installs security patches automatically at 3 AM
```

### 12.2 Nginx Rate Limiting (Internal DDoS Protection)

```bash
cd /var/www/kucet-cms
nano DEPLOYMENT_PACKAGE/nginx/nginx.conf
```

Inside the `http { }` block, add:

```nginx
limit_req_zone $binary_remote_addr zone=kucet_limit:10m rate=10r/s;
```

Inside the `location / { }` block, add:

```nginx
limit_req zone=kucet_limit burst=20 nodelay;
```

Restart Nginx after saving:

```bash
cd /var/www/kucet-cms
docker compose -f DEPLOYMENT_PACKAGE/docker-compose.yml restart nginx
```

### 12.3 Fail2Ban SSH Protection (Already Installed)

```bash
cd ~
# Verify fail2ban is monitoring SSH
fail2ban-client status sshd
```

### 12.4 Redis Password (Production Hardening)

```bash
cd /var/www/kucet-cms
nano DEPLOYMENT_PACKAGE/docker-compose.yml
```

Add to the redis service command:

```yaml
command: redis-server --appendonly yes --requirepass YOUR_STRONG_REDIS_PASSWORD
```

Update `.env.production`:

```env
REDIS_URL=redis://:YOUR_STRONG_REDIS_PASSWORD@redis:6379
```

Restart Redis:

```bash
cd /var/www/kucet-cms
docker compose -f DEPLOYMENT_PACKAGE/docker-compose.yml restart redis app
```

---

## PHASE 13: CLOUDFLARE TUNNEL (ALTERNATIVE TO DIRECT IP)

If you want to hide the VPS IP completely behind Cloudflare (recommended):

```bash
cd ~
# Install cloudflared
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
dpkg -i cloudflared.deb

# Authorize
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create kucet-cms

# Route subdomain
cloudflared tunnel route dns kucet-cms login.kucet.in

# Create config
mkdir -p /etc/cloudflared
cat > /etc/cloudflared/config.yml << 'EOF'
tunnel: <YOUR-TUNNEL-UUID>
credentials-file: /root/.cloudflared/<YOUR-TUNNEL-UUID>.json

ingress:
  - hostname: login.kucet.in
    service: http://localhost:80
  - service: http_status:404
EOF

# Install as service (auto-starts on reboot)
cloudflared service install
systemctl enable cloudflared
systemctl start cloudflared
```

---

## PHASE 14: AUTONOMOUS DEPLOYMENT SETUP (ZERO-MANUAL-INTERVENTION)

### What This Achieves

After running the one-time setup command below, the KUCET CMS server becomes **fully autonomous**:

- **GitHub push → auto-deploy**: Any push to `main` triggers the GitHub Actions runner, which runs `deploy.sh`, builds the new container, validates health, and rolls back automatically if anything fails — all without human involvement.
- **Self-healing containers**: A cron monitor runs every 5 minutes and automatically restarts any stopped Docker container or GitHub Actions runner service.
- **Auto-rollback on failure**: If `/api/health` fails 3 consecutive times, the monitor triggers a rollback to the last known-good deployment automatically.
- **Boot recovery**: On every server restart, `boot-recovery.sh` runs automatically and brings up all containers before the runner accepts new jobs.
- **Log management**: All logs rotate daily, compressed, kept for 30 days — no manual cleanup needed.

---

### One-Time Setup Command

SSH into the server and run:

```bash
cd /var/www/kucet-cms
sudo bash DEPLOYMENT_PACKAGE/SCRIPTS/setup-all.sh
```

This single command runs all setup steps in order and prints a final summary confirming the autonomous deployment is configured.

---

### What `setup-all.sh` Does Internally

| Step | Script Called | Purpose |
|------|--------------|---------|
| 1 | *(inline)* | Creates `/var/log/kucet/` directory |
| 2 | `setup-runner-service.sh` | Installs GitHub Actions runner as systemd service; enables docker + containerd |
| 3 | `setup-logrotate.sh` | Installs `/etc/logrotate.d/kucet-cms` config |
| 4 | `setup-cron.sh` | Installs all cron jobs idempotently |
| 5 | *(inline)* | `chmod +x` on all `.sh` scripts in `SCRIPTS/` |
| 6 | `boot-recovery.sh` | Verifies initial container/runner state |

---

### Individual Scripts Reference

| Script | When It Runs | Purpose |
|--------|-------------|---------|
| `setup-all.sh` | Once, manually | Master orchestrator — runs all setup in order |
| `setup-runner-service.sh` | Once, via setup-all | Registers GitHub runner as systemd service |
| `setup-logrotate.sh` | Once, via setup-all | Installs logrotate config to `/etc/logrotate.d/` |
| `setup-cron.sh` | Once, via setup-all | Installs all cron jobs idempotently |
| `deploy.sh` | GitHub Actions CI | Full deploy: pull → migrate → build → health check → rollback |
| `rollback.sh` | Auto (by deploy/monitor) | Reverts to a specific commit; health-checks; alerts on CRITICAL fail |
| `health-check.sh` | After every deploy | 13-point PASS/FAIL check; supports `--json` flag |
| `monitor.sh` | Every 5 min (cron) | Self-healing: restarts containers/runner; triggers rollback on repeated failure |
| `boot-recovery.sh` | On reboot (cron @reboot) | Waits for Docker, starts all containers, verifies health |
| `setup-logrotate.sh` | Once, via setup-all | Logrotate config installation |
| `nightly-backup.sh` | Daily 02:00 (cron) | MySQL backup to local storage |
| `offsite-backup.sh` | Daily 04:00 (cron) | Uploads backups to offsite storage |

---

### Verification Steps

After running `setup-all.sh`, verify each component:

#### 1. GitHub Actions Runner (systemd)
```bash
# Check service is active and enabled
systemctl status actions.runner.*

# Confirm it auto-starts on reboot
systemctl is-enabled actions.runner.*
```
Expected: `active (running)` and `enabled`

#### 2. Cron Jobs
```bash
crontab -l
```
Expected output should include:
```
*/5 * * * * /var/www/kucet-cms/DEPLOYMENT_PACKAGE/SCRIPTS/monitor.sh ...
0 2 * * * /var/www/kucet-cms/DEPLOYMENT_PACKAGE/SCRIPTS/nightly-backup.sh ...
0 4 * * * /var/www/kucet-cms/DEPLOYMENT_PACKAGE/SCRIPTS/offsite-backup.sh ...
@reboot /var/www/kucet-cms/DEPLOYMENT_PACKAGE/SCRIPTS/boot-recovery.sh ...
```

#### 3. Docker Auto-start
```bash
systemctl status docker
systemctl is-enabled docker
systemctl is-enabled containerd
```
Expected: `active (running)` and `enabled`

#### 4. Logrotate Config
```bash
cat /etc/logrotate.d/kucet-cms
logrotate -d /etc/logrotate.d/kucet-cms
```

#### 5. Boot Recovery Test
To simulate boot recovery without rebooting:
```bash
sudo bash /var/www/kucet-cms/DEPLOYMENT_PACKAGE/SCRIPTS/boot-recovery.sh
cat /var/log/kucet/boot-recovery.log
```

#### 6. Full Health Check
```bash
bash /var/www/kucet-cms/DEPLOYMENT_PACKAGE/SCRIPTS/health-check.sh
# Or for JSON output (e.g. for monitoring integrations):
bash /var/www/kucet-cms/DEPLOYMENT_PACKAGE/SCRIPTS/health-check.sh --json
```

---

### Log File Locations

| Log File | Contents |
|----------|---------|
| `/var/log/kucet/deploy_YYYYMMDD_HHMMSS.log` | Per-deployment log (all output) |
| `/var/log/kucet/deployments.json` | JSON record of all deployments |
| `/var/log/kucet/rollback_YYYYMMDD_HHMMSS.log` | Per-rollback log |
| `/var/log/kucet/monitor.log` | Continuous monitor activity log |
| `/var/log/kucet/boot-recovery.log` | Boot recovery log |
| `/var/log/kucet/backup.log` | Nightly backup log |
| `/var/log/kucet/offsite-backup.log` | Offsite backup log |
| `/var/log/kucet/health-check.log` | Health check history |

All logs are rotated daily, compressed after 1 day delay, and kept for **30 days**.

---

## DEPLOYMENT HEALTH CHECKLIST

Run through this checklist after every deployment:

- [ ] `docker compose ps` → all containers show `healthy`
- [ ] `curl https://login.kucet.in/api/health` → returns `{"status":"ok"}`
- [ ] Login as Admin → check College Config loads
- [ ] Login as Student → check dashboard loads
- [ ] Check Uptime Kuma dashboard → all monitors green
- [ ] Verify daily backup ran: `ls -lh /var/kucet-db-backup/`
- [ ] Check disk space: `df -h /` → must have >20GB free
- [ ] Check RAM usage: `free -h` → should show <6GB used + swap available

---

**Lead Architect:** P. Sannith
**System Integrator:** Antigravity CLI
**Hosting:** Hostinger KVM 2 — Mumbai DC (2 vCPU / 8GB RAM / 100GB NVMe)
**Last Updated:** August 2, 2026 (Revision 3.0 — Hostinger Edition)

# KUCET CMS Self-Hosting Setup Guide

This package contains the configuration required to self-host the KUCET College Management System on your own server (Ubuntu/Debian recommended).

## 1. Prerequisites
- **Docker & Docker Compose** installed.
- **Git** installed.
- A **Domain Name** pointed to your server (or using Cloudflare Tunnel).
- **Cloudinary** account (Optional - supports hybrid storage).
- **Brevo** account (for emails).

## 2. Quick Start

1. **Clone & Prepare**:
   ```bash
   cd /var/www/kucet-cms
   # Move the .env.production.template to .env.production
   cp DEPLOYMENT_PACKAGE/.env.production.template .env.production
   ```

2. **Configure Environment Variables**:
   Edit `.env.production` and fill in all the required secrets.
   - Set `DB_HOST=db` (matches the docker-compose service name).
   - Set `REDIS_URL=redis://redis:6379`.
   - Ensure `NEXT_PUBLIC_BASE_URL` matches your domain (e.g., `https://login.kucet.ac.in`).

3. **Deploy**:
   ```bash
   cd /var/www/kucet-cms
   docker compose -f DEPLOYMENT_PACKAGE/docker-compose.yml up -d --build
   ```

4. **Initialize Database**:
   The first time you run the app, you need to push the schema:
   ```bash
   cd /var/www/kucet-cms
   docker exec -it kucet-cms-app npm run db:push
   ```

---

## 3. Cloudflare Setup (Recommended)

Using **Cloudflare Tunnel (Argo Tunnel)** is the most secure way to self-host. It doesn't require opening any ports on your router/firewall. 

1. **Install `cloudflared`** on your server.
2. **Login**: 
   ```bash
   cd ~
   cloudflared tunnel login
   ```
3. **Create Tunnel**: 
   ```bash
   cd ~
   cloudflared tunnel create kucet-cms
   ```
4. **Configure DNS**: 
   ```bash
   cd ~
   cloudflared tunnel route dns kucet-cms login.kucet.ac.in
   ```
5. **Run Tunnel**:
   Create a `config.yml`:
   ```bash
   cd /etc
   sudo mkdir -p cloudflared
   cd cloudflared
   sudo nano config.yml
   ```
   *Paste the following config:*
   ```yaml
   tunnel: <TUNNEL_ID>
   credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

   ingress:
     - hostname: login.kucet.ac.in
       service: http://localhost:80
     - service: http_status:404
   ```
6. **Start**: 
   ```bash
   cd ~
   sudo cloudflared service install
   sudo systemctl enable cloudflared
   sudo systemctl start cloudflared
   ```

### Why Cloudflare?
- **DDoS Protection**: Absorbs attacks before they hit your server.
- **SSL/TLS**: Automatic managed certificates.
- **Edge Caching**: Speeds up static asset delivery.
- **WAF**: Web Application Firewall to block malicious requests.

---

## 4. Optimal Network Requirements

For a College Management System serving several hundred to thousands of students/staff:

### Optimal Speed:
- **Download**: 100 Mbps (For updates and pulling Docker images).
- **Upload**: **50 Mbps minimum** (Crucial, as the server *uploads* data to users).
- **Latency**: < 30ms to your primary user base (Warangal/Telangana region).

### Server Hardware (Minimum):
- **CPU**: 4 Cores (Modern Intel/AMD).
- **RAM**: 8 GB (16 GB recommended for MySQL/Redis overhead).
- **Storage**: 100 GB SSD/NVMe (MySQL performance depends heavily on disk I/O).

---

## 5. Maintenance
- **Backups**: Use scripts in the `scripts/` folder.
- **Logs**: `docker compose -f DEPLOYMENT_PACKAGE/docker-compose.yml logs -f app`.
- **Updates**: 
  ```bash
  cd /var/www/kucet-cms
  git pull
  docker compose -f DEPLOYMENT_PACKAGE/docker-compose.yml up -d --build
  ```
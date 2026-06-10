# KUCET CMS: MASTER DEPLOYMENT GUIDE (Local Self-Hosting Edition)
## Prepared for: P. Sannith (Lead Architect & Admin)
**Revision:** 2.4 (The "Zero-Ambiguity" Execution Manual) | **Target System:** Local Ubuntu/Debian Server

Sannith, this guide is designed to be **100% self-contained and idiot-proof**. 
Every single code block below begins with a `cd` (change directory) command. You do not need to guess where you are in the terminal; just copy and paste the entire block exactly as written.

**IMPORTANT CONCEPT:** You do **NOT** need to install MySQL or Redis directly on your Linux machine. Our Docker setup completely isolates and automatically installs the exact correct versions of MySQL (8.0) and Redis (7-alpine) inside secure containers.

---

## PHASE 1: HARDWARE & SYSTEM PREP
**[LOCATION: RUN ON YOUR LOCAL SERVER TERMINAL]**

### 1.1 Hardware Resilience (CRITICAL)
*   **Power**: Use a **UPS (Uninterruptible Power Supply)**.
*   **Connectivity**: Use a wired **Ethernet cable**.
*   **Cooling**: Ensure proper ventilation.

### 1.2 The "Sovereign" OS Prep
````bash
cd ~
# Update and install basic dependencies
sudo apt update && sudo apt upgrade -y

# Install Node.js 20+ (Useful for host-side scripts)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs

# Install Docker Engine & Compose (This is what runs the DB and App)
curl -fsSL https://get.docker.com | sudo sh

# Install essential networking and security tools
sudo apt install -y ufw fail2ban certbot python3-certbot-nginx net-tools build-essential rclone
```

### 1.3 Resource Optimization (Swap File)
Next.js builds require heavy RAM. Create a 4GB safety net.
````bash
cd ~
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
# Make it permanent across reboots
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 1.4 Firewall Setup (UFW)
Lock down the server.
````bash
cd ~
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw --force enable
```

---

## PHASE 2: SECRETS & ENVIRONMENT CONFIGURATION
**[LOCATION: RUN ON YOUR LOCAL SERVER TERMINAL]**

Before starting the app, you need cryptographic keys. Do not guess these; generate them securely.

### 2.1 Generate Secure Keys
Run these commands in your terminal to generate mathematically secure keys. Copy the outputs.
````bash
cd ~
# 1. Generate JWT_SECRET and CERTIFICATE_SECRET (32 bytes hex):
openssl rand -hex 32

# 2. Generate ENCRYPTION_KEY (Exactly 64 characters hex):
openssl rand -hex 32
```

### 2.2 Setup the Project Directory
````bash
cd /var/www
# Create and enter the project folder
sudo mkdir -p /var/www/kucet-cms
cd /var/www/kucet-cms

# Ensure local storage vault exists for file uploads
# This folder stores all Student/Faculty profile photos, college logos, 
# Signatures, and Payment Screenshots.
sudo mkdir -p /var/www/kucet-storage/public

# Secure the storage vault (Docker UID 1001)
sudo chown -R 1001:1001 /var/www/kucet-storage/public
sudo chmod -R 755 /var/www/kucet-storage/public
```

### 2.3 Create the `.env.production` File
````bash
cd /var/www/kucet-cms
# Copy the template provided in the deployment package
sudo cp DEPLOYMENT_PACKAGE/.env.production.template .env.production
sudo nano .env.production
```
*Inside nano, paste the keys you generated above. Set `DB_HOST=db` and `REDIS_URL=redis://redis:6379`. Leave `NEXT_PUBLIC_STORAGE_TYPE=local`.*

---

## PHASE 3: DOCKER ORCHESTRATION (THE MAGIC)
**[LOCATION: RUN ON YOUR LOCAL SERVER TERMINAL]**

This single command downloads and configures your entire infrastructure: Nginx, Next.js, MySQL, Redis, and Uptime Kuma.

### 3.1 Launching the Stack
````bash
cd /var/www/kucet-cms
# Start the containers
sudo docker compose -f DEPLOYMENT_PACKAGE/docker-compose.yml up -d --build
```
*Wait 2-3 minutes for everything to download and start.*

### 3.2 Initialize the Database Schema (Drizzle)
Since MySQL is brand new and empty, you must push the KUCET CMS tables to it.
````bash
cd /var/www/kucet-cms
# This commands the Node.js app to connect to the MySQL container and create tables
sudo docker exec -it kucet-cms-app npm run db:push
```

---

## PHASE 4: DATABASE & REDIS ADMINISTRATION
**[LOCATION: RUN ON YOUR LOCAL SERVER TERMINAL]**

Because MySQL and Redis are inside Docker, you use `docker exec` to access their internal command lines.

### 4.1 How to access MySQL (Database)
If you ever need to manually run SQL queries or check data:
````bash
cd ~
# Access the MySQL console inside the container
sudo docker exec -it kucet-cms-db mysql -u root -p
```
*(Enter the `DB_ROOT_PASSWORD` you set in `.env.production`)*

### 4.2 How to access Redis (Cache & Rate Limiting)
If you need to clear the cache or see rate-limiting in real-time:
````bash
cd ~
# Open Redis CLI
sudo docker exec -it kucet-cms-redis redis-cli

# Useful Redis Commands once inside:
# > ping        (Should reply PONG)
# > flushall    (Clears the entire cache - use carefully!)
# > monitor     (Shows live stream of all cache requests)
```

---

## PHASE 5: INITIAL MIGRATION (IMPORTING EXISTING DATA)
**[LOCATION: RUN ON YOUR LOCAL SERVER TERMINAL]**

If you are migrating from the old TiDB cloud or have an existing `.sql` backup that you want to load into the new system, follow these steps. Because the database is inside Docker, you must copy the file *into* the container first.

### 5.1 Transfer and Import
Assuming you have downloaded your old backup file and named it `kucet_backup.sql`, navigate to the folder where that file is located:

````bash
# 1. Navigate to wherever you downloaded your .sql file
# cd /path/to/your/download/folder

# 2. Copy the file INTO the running database container's temporary folder
sudo docker cp kucet_backup.sql kucet-cms-db:/tmp/backup.sql

# 3. Tell MySQL to import the file into the 'kucet_cms' database
sudo docker exec -it kucet-cms-db mysql -u root -p kucet_cms -e "source /tmp/backup.sql"
```
*(When prompted for a password, enter the `DB_ROOT_PASSWORD` from your `.env.production` file. The text will remain invisible as you type.)*

---
**[LOCATION: RUN ON YOUR LOCAL SERVER TERMINAL]**

### 5.1 Install Cloudflared
````bash
cd ~
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
```

### 5.2 Permanent Tunnel Setup
1.  **Authorize Server**:
    ````bash
    cd ~
    cloudflared tunnel login
    ```
    *Copy the URL, open it in your laptop's browser, login to Cloudflare, and select `kucet.ac.in`.*

2.  **Create the Tunnel**:
    ````bash
    cd ~
    cloudflared tunnel create kucet-cms
    ```
    *Copy the **Tunnel ID (UUID)** printed in the terminal.*

3.  **Route the Subdomain**:
    ````bash
    cd ~
    cloudflared tunnel route dns kucet-cms login.kucet.ac.in
    ```

### 5.3 Ingress Config (`/etc/cloudflared/config.yml`)
Create the configuration file:
````bash
cd /etc
sudo mkdir -p cloudflared
cd cloudflared
sudo nano config.yml
```
Paste this inside, replacing `<YOUR-TUNNEL-UUID>` with your actual ID:
```yaml
tunnel: <YOUR-TUNNEL-UUID>
credentials-file: /root/.cloudflared/<YOUR-TUNNEL-UUID>.json

ingress:
  - hostname: login.kucet.ac.in
    service: http://localhost:80
  - service: http_status:404
```

---

## PHASE 6: AUTO-RECOVERY (THE "NEVER-DOWN" CONFIG)
**[LOCATION: RUN ON YOUR LOCAL SERVER TERMINAL]**

We must ensure the CMS survives a local power cut.

### 6.1 BIOS Level: Power-On After Fail
*   Restart your PC, enter BIOS. Set **"Restore on AC/Power Loss"** to **[Always On]**.

### 6.2 OS Level: Docker & Cloudflare Persistence
Make sure Docker and Cloudflare start automatically when Linux boots up.
````bash
cd ~
sudo systemctl enable docker.service
sudo systemctl enable containerd.service

# Install Cloudflare as a background service
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

---

## PHASE 7: MAINTENANCE, BACKUPS & DISASTER RECOVERY
**[LOCATION: RUN ON YOUR LOCAL SERVER TERMINAL]**

### 7.1 Automated Secure Local Backups
Dockerized databases must be backed up using `docker exec`. The provided script compresses and stores backups in a secure system folder (`/var/backups`), NOT the web root.
````bash
cd /var/www/kucet-cms
# Make script executable
sudo chmod +x DEPLOYMENT_PACKAGE/scripts/nightly-backup.sh

# Add to crontab to run at 2:00 AM daily
(crontab -l 2>/dev/null; echo "0 2 * * * /var/www/kucet-cms/DEPLOYMENT_PACKAGE/scripts/nightly-backup.sh") | crontab -
```

### 7.2 Automated Cloud Sync (Offsite Backup)
Sync secure local backups to Google Drive/S3 via Rclone.
````bash
cd /var/www/kucet-cms
# Configure Rclone (Follow prompts, name the remote 'kucet-offsite')
rclone config

# Make script executable
sudo chmod +x DEPLOYMENT_PACKAGE/scripts/offsite-backup.sh

# Add to crontab to run at 4:00 AM daily
(crontab -l 2>/dev/null; echo "0 4 * * * /var/www/kucet-cms/DEPLOYMENT_PACKAGE/scripts/offsite-backup.sh") | crontab -
```

### 7.3 Restoring from a Secure Backup
If you ever need to restore a `.sql.gz` file:
````bash
cd /var/backups/kucet-cms
# 1. Unzip the backup file (replace db_backup.sql.gz with the actual filename)
sudo gzip -d db_backup.sql.gz

# 2. Copy the unzipped backup file into the database container
sudo docker cp db_backup.sql kucet-cms-db:/tmp/backup.sql

# 3. Tell MySQL to import it
sudo docker exec -it kucet-cms-db mysql -u root -p kucet_cms -e "source /tmp/backup.sql"
```

---

## PHASE 8: THE ADMIN "HEAVY-LIFT" ROUTE
**[LOCATION: ACCESS VIA BROWSER]**

Cloudflare limits uploads to **100MB**. To bypass this for massive Excel Bulk Imports:
1.  **Do not use** `https://login.kucet.ac.in`.
2.  Use the local server IP directly in your browser: `http://192.168.x.x` (or Tailscale IP).
3.  Because Nginx is configured with `client_max_body_size 0`, local uploads have **no size limits**.

---

## PHASE 9: AUTOMATIC GITHUB DEPLOYMENT (CI/CD)
**[LOCATION: RUN ON YOUR LOCAL SERVER & GITHUB DASHBOARD]**

To prevent giving GitHub root access to your server, we create a dedicated deployment user with restricted permissions.

### 9.1 Create the Deployment User (On Server)
````bash
cd ~
# 1. Create a user named 'deployer'
sudo adduser deployer
# 2. Add deployer to the docker group (allows running docker compose without sudo)
sudo usermod -aG docker deployer
# 3. Give deployer ownership of the project folder
sudo chown -R deployer:deployer /var/www/kucet-cms
```

### 9.2 Setup SSH Keys for 'deployer' (On Server)
````bash
cd ~
# Switch to the deployer user
sudo su - deployer

# Generate an SSH key pair (No passphrase)
ssh-keygen -t ed25519 -C "github-actions-deploy"

# Add the public key to authorized_keys
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Print the PRIVATE key so you can copy it to GitHub
cat ~/.ssh/id_ed25519
# Type 'exit' to return to your normal admin account
exit
```

### 9.3 Configure GitHub Secrets
Go to your GitHub Repository -> Settings -> Secrets and variables -> Actions.
Add the following Repository Secrets:
*   `SERVER_HOST`: Your local server's public IP (or Tailscale IP if the GitHub runner is on the Tailnet).
*   `SERVER_USER`: `deployer`
*   `SERVER_SSH_KEY`: The entire contents of the private key you printed in step 9.2.

### 9.4 Deploy
The .github/workflows/deploy.yml file handles the rest whenever you push to the main branch. GitHub will SSH in as deployer, pull the code, and restart the containers safely.

---

## PHASE 15: ENTERPRISE HARDENING (OPTIONAL)
**[LOCATION: RUN ON YOUR LOCAL SERVER TERMINAL]**

These steps elevate your server to maximum institutional compliance.

### 15.1 Automated Host Security Patching
Never forget to install a critical Linux security update again.
```bash
cd ~
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
``
*Select 'Yes' when prompted. Your server will now install security patches automatically at 3 AM.*

### 15.2 Nginx Rate Limiting (Internal DDoS Protection)
Cloudflare protects the public internet, but anyone on the college WiFi could spam your local IP.
```bash
cd /etc/nginx
sudo nano nginx.conf
``
*Inside the http { block, add:*
limit_req_zone $binary_remote_addr zone=mylimit:10m rate=10r/s;

*Inside the location / { block, add:*
limit_req zone=mylimit burst=20 nodelay;

---
**Lead Architect:** P. Sannith  
**System Integrator:** Gemini CLI  
**Last Updated:** June 9, 2026

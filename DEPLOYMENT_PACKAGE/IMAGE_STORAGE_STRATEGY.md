# Self-Hosted Image Storage Strategy & Google Drive Backup

## 1. Best Image Storing Mechanisms for Self-Hosting

For a self-hosted application like the KUCET CMS, you have two primary methods for storing images and assets, balancing simplicity, performance, and scalability.

### A. Local Filesystem + Nginx (Recommended for Single-Server)
The simplest and most performant approach for a single VPS or dedicated server.
- **How it works:** Assets (like student photos, staff photos, signatures, PDFs) are stored directly on the server's disk in `/var/www/kucet-storage` mounted inside Docker as `/app/storage`.
- **Delivery:** An Nginx reverse proxy serves authorized static files securely via internal `X-Accel-Redirect`.
- **Pros:** Sub-10ms delivery times on local networks, zero external dependencies, no egress bandwidth costs.
- **Cons:** Harder to scale horizontally across multiple servers; requires disk space monitoring.

### B. Self-Hosted Object Storage - MinIO (Recommended for Scalability)
If you anticipate high growth or deploying across multiple servers (Docker Swarm/Kubernetes).
- **How it works:** You install [MinIO](https://min.io/), an open-source, S3-compatible object storage server. The Next.js application uses the standard AWS S3 SDK to read/write images to MinIO.
- **Pros:** Highly scalable, supports data replication and redundancy, standard S3 API compatibility.
- **Cons:** Adds operational overhead (another service to manage, configure, and secure).

---

## 2. The Current Application Mechanism
According to the codebase, the KUCET CMS employs a unified strategy provider approach:
- **Strategy Pattern Storage:** Configurable via `STORAGE_TYPE=local` or `STORAGE_TYPE=cloudinary` in `.env.production`.
- **Local VPS Storage:** Mounted persistently from `/var/www/kucet-storage` to `/app/storage`.
- **Nightly Backups:** The script `nightly-backup.sh` is designed to compress the local storage directory (`/var/www/kucet-storage`) along with the database for safe-keeping.

---

## 3. Backing Up Assets to Google Drive

To backup all your images, databases, and assets directly to Google Drive on a schedule, the industry standard is **Rclone**. It is a command-line program that syncs files to cloud storage securely.

### Step 1: Install Rclone
On your Ubuntu/Debian server:
```bash
sudo -v ; curl https://rclone.org/install.sh | sudo bash
```

### Step 2: Configure Google Drive
Run the configuration wizard:
```bash
rclone config
```
1. Type `n` for a **New remote**.
2. Name it `gdrive` (or anything you prefer).
3. Select the number for **Google Drive** (usually `drive`).
4. Leave the `client_id` and `client_secret` blank (or provide your own Google Cloud API credentials for higher rate limits).
5. Choose scope `1` (Full access).
6. Leave `service_account_file` blank.
7. Say `N` to advanced config.
8. Say `Y` to use auto config if you have a GUI, or `N` if on a headless server (it will give you a link to paste into your local browser to authorize).

### Step 3: Backup Commands

We have already updated the `DEPLOYMENT_PACKAGE/SCRIPTS/nightly-backup.sh` script to include the automated Rclone sync commands.

**To manually copy an archive to Google Drive:**
```bash
rclone copy /var/www/backups gdrive:kucet-backups/archives
```

**To continuously sync the live assets folder:**
```bash
# Sync ensures the Google Drive folder exactly matches your local folder
rclone sync /var/www/kucet-storage gdrive:kucet-backups/live-assets
```

### Step 4: Automate via Cron
To run the automated backup every night at 2:00 AM, add it to your server's crontab:
```bash
crontab -e
```
Add the following line:
```cron
0 2 * * * /path/to/DEPLOYMENT_PACKAGE/SCRIPTS/nightly-backup.sh >> /var/log/kucet-backup.log 2>&1
```

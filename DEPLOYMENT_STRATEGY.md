# KUCET CMS: Infrastructure & Deployment Strategy (2026)

## 1. Overview
This document outlines a high-performance, cost-effective deployment strategy for the KUCET College Management System. The goal is to support ~2,000+ students with 99.9% uptime while keeping monthly operational costs near zero or budget-friendly.

---

## 2. Institutional Subdomain Strategy

The college's primary domain `kucet.ac.in` is already in use for the main website. To ensure zero risk to the main site while maintaining professional institutional branding, we use a **Subdomain + CNAME** approach.

*   **Primary Subdomain:** `login.kucet.ac.in`
*   **Alternative Options:** `portal.kucet.ac.in`, `cms.kucet.ac.in`
*   **Method:** Create a **CNAME record** in the college's cPanel (Zone Editor) pointing `login` to the modern hosting provider (Vercel/Railway).

**Benefits:**
- **Isolation:** CMS traffic does not slow down the main college website.
- **Security:** If the main site is compromised, the CMS remains secure (and vice versa).
- **Professionalism:** Students use an official `ac.in` address instead of a `.vercel.app` or `.railway.app` URL.

---

## 3. Recommended Deployment Stacks

### Option A: The "Zero Cost" Tier (100% Free)
*Ideal for testing, development, or initial launch with low traffic.*

| Component | Provider | Cost | Rationale |
| :--- | :--- | :--- | :--- |
| **Frontend & API** | **Vercel (Hobby)** | $0/mo | Native Next.js support, Global CDN, Auto-SSL. |
| **Database (MySQL)** | **TiDB Cloud** | $0/mo | 5GB free storage, managed MySQL-compatible clusters. |
| **Real-time Hub** | **Supabase (Free)** | $0/mo | Real-time broadcasting via WebSockets. |
| **Rate Limiting** | **Upstash Redis** | $0/mo | Serverless Redis for login protection. |
| **Media Assets** | **Cloudinary (Free)**| $0/mo | 25GB storage for student photos/signatures. |
| **Total Cost** | | **$0/month** | |

### Option B: The "Budget Production" Tier (Recommended)
*Ideal for 500+ concurrent students (e.g., Attendance Morning Rush).*

| Component | Provider | Cost | Rationale |
| :--- | :--- | :--- | :--- |
| **Hosting (Next.js)** | **Railway.app** | ~$5/mo | Persistent Node.js server (No cold starts or timeouts). |
| **Database** | **Railway MySQL** | Included | Integrated high-performance MySQL instance. |
| **Subdomain** | **login.kucet.ac.in**| $0 (Owned) | Professional institutional branding via DNS. |
| **Redis & Storage** | **Upstash/Cloudinary**| $0/mo | Continue using free tiers until scale requires paid. |
| **Total Cost** | | **~$5–$10/mo** | **(approx ₹450 - ₹900/month)** |

---

## 4. Environment Workflow (Git-Flow)

### A. Development (`testvanilla` branch)
*   **Purpose:** Active feature development and bug fixing.
*   **Database:** Local MySQL or Shared Development TiDB.

### B. Staging (`staging` branch)
*   **Purpose:** Pre-production validation. **Mirror of Production.**
*   **Actions:** Automated E2E (Playwright) and Load (k6) tests. Database migrations (`db:migrate`) tested here first.

### C. Production (`main` branch)
*   **Purpose:** Live institutional portal (`login.kucet.ac.in`).
*   **Trigger:** Merging from `staging` into `main` after verification.

---

## 5. Security & Scaling Considerations

### A. Configuration Governance (Fail-Fast)
The application uses **Zod-based environment validation**. In production, it will refuse to start if critical keys are missing:
*   `ENCRYPTION_KEY` (64-character hex for AES-256)
*   `DATABASE_URL` (MySQL Connection string)
*   `NEXTAUTH_SECRET` (JWT Security)

### B. Database Disaster Recovery

#### 1. Point-in-Time Recovery (PITR)
**CRITICAL.** Ensure PITR is "ON" in TiDB or Railway dashboard. This allows "rewinding" the database to any specific second to recover from accidental deletions without using a backup file.

#### 2. Automated Backups (Daily)
The system automatically performs a daily dump and uploads it to Cloudinary with `authenticated` access mode.
- **Location:** `kucet/backups` folder in Cloudinary.
- **Retention:** 30 daily, 4 weekly, 12 monthly backups.
- **Integrity:** Verified via MD5 checksum during upload.

#### 3. Restoration Procedure (Emergency)
To restore a backup to a fresh MySQL instance, follow these steps:

**Step 1: Download the Backup**
Locate the desired `.sql` file in the Cloudinary Media Library (Authenticated Access) or use the Cloudinary CLI:
```bash
# Using Cloudinary CLI (requires CLOUDINARY_URL env)
cld admin resource kucet/backups/kucet_db_backup_2026-03-21T00-00-00-000Z.sql -t raw
```
*Alternatively, download via the Cloudinary Dashboard directly.*

**Step 2: Prepare Fresh MySQL Instance**
Ensure the database exists on the new server:
```sql
CREATE DATABASE kucet_cms;
```

**Step 3: Restore the SQL Dump**
Use the standard MySQL client to import the downloaded file:
```bash
# Command Template
mysql -h <new_host> -u <new_user> -p <database_name> < downloaded_backup.sql

# Example for Railway/TiDB
mysql -h aws.connect.tidbcloud.com -u <user> -p kucet_cms < kucet_db_backup_2026-03-21.sql
```

**Step 4: Re-run Migrations**
Ensure the schema is perfectly synced with the code:
```bash
npm run db:migrate
```

---

## 6. Privacy & Data Governance
### A. Institutional Data Policy
- **Encryption:** Aadhaar and Mobile numbers are AES-256-GCM encrypted at rest.
- **Verification Logging:** To prevent certificate forgery, the system logs the **IP Address**, **Device Type**, and **Approximate Location** (via GeoIP) whenever a certificate QR code is scanned.
- **Retention:** Audit logs are kept for 2 years. Verification archives are moved to cold storage after 6 months.
- **Compliance:** All data handling must comply with the [Institutional Privacy Policy](./PRIVACY_POLICY.md).

---

## 7. Implementation Checklist (Go-Live)
1. [ ] **cPanel DNS:** Add CNAME `login` -> (Vercel/Railway URL).
2. [ ] **Environment Setup:** Add all `.env` secrets to the hosting provider's dashboard.
3. [ ] **Database Migration:** Run `npm run db:migrate` to initialize the production schema.
4. [ ] **Asset Sync:** Run `node cloudinary_sync.js` to ensure all core institutional logos are in the cloud.
5. [ ] **SSL Verification:** Ensure HTTPS is active on `login.kucet.ac.in`.

---
**Prepared by:** Gemini CLI  
**Last Updated:** March 21, 2026

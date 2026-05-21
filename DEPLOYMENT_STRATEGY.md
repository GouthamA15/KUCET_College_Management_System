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

### C. Observability & Monitoring (The "Invisible Bug" Problem)

#### 1. Distributed Tracing
As the Service Layer grows, "where is it slow?" becomes a critical question.
- **Requirement:** Integrate a tool like **Datadog**, **New Relic**, or **Sentry Performance**.
- **Action:** This will provide a flame graph for every request, showing exactly which Drizzle query or API call is causing a bottleneck during high-traffic periods.

#### 2. Automated Load Testing (Gatekeeper)
The system includes a k6 load test suite (`load-test-attendance.js`).
- **Requirement:** Run the **"Morning Rush"** load test simulation (500 concurrent users) against the **Staging Environment** before every major release to the `main` branch.
- **Threshold:** P(95) response time must be **< 500ms** for the attendance marking flow to pass the production gate.

---

## 6. Privacy & Data Governance
### A. Institutional Data Policy
- **Encryption:** Aadhaar and Mobile numbers are AES-256-GCM encrypted at rest.
- **Verification Logging:** To prevent certificate forgery, the system logs the **IP Address**, **Device Type**, and **Approximate Location** (via GeoIP) whenever a certificate QR code is scanned.
- **Retention:** Audit logs are kept for 2 years. Verification archives are moved to cold storage after 6 months.
- **Compliance:** All data handling must comply with the [Institutional Privacy Policy](./PRIVACY_POLICY.md).

## 7. Mobile SMS Infrastructure (Future Expansion)
To support OTPs, attendance alerts, and fee reminders via SMS, the following providers are recommended based on affordability and reliability in the Indian market (2026).

### A. Recommended SMS API Providers

| Provider | Purpose | Approx. Cost | Key Advantage |
| :--- | :--- | :--- | :--- |
| **Fast2SMS** | Bulk Alerts / Budget | ₹0.12 - ₹0.20 | Lowest entry cost; ideal for general announcements. |
| **2Factor** | Mission-Critical OTP | ₹0.15 - ₹0.18 | **15-second delivery guarantee**; pay-per-delivery model. |
| **MSG91** | Developer Scale | ₹0.16 - ₹0.22 | Best API documentation; Startup program (25k free SMS/mo). |
| **Textlocal** | Admin Dashboard | ₹0.20 - ₹0.25 | Superior UI for manual staff broadcasts (Fees/Holidays). |

### B. Mandatory DLT Compliance (TRAI India)
Before sending any SMS, the college **must** complete the Distributed Ledger Technology (DLT) registration:
1. **Entity Registration:** Register KUCET as a "Principal Entity" on a portal (e.g., Jio/Airtel DLT).
2. **Header (Sender ID):** Claim a 6-character alphabetic ID (e.g., `KUCETC`).
3. **Template Approval:** Every message format (e.g., *"Your OTP is {#var#}"*) must be pre-approved by the DLT provider to avoid blocking.

### C. Technical Implementation Strategy
* **OTP Priority:** Use **2Factor** for login/security OTPs due to their dedicated high-speed routes.
* **Bulk Priority:** Use **Fast2SMS** for non-urgent attendance or fee notifications to minimize operational costs.
* **Fallback:** Consider **WhatsApp Business API** (via MSG91) as a secondary channel for high-priority documents.

---

## 8. Implementation Checklist (Go-Live)
1. [ ] **cPanel DNS:** Add CNAME `login` -> (Vercel/Railway URL).
2. [ ] **Environment Setup:** Add all `.env` secrets to the hosting provider's dashboard.
3. [ ] **Database Migration:** Run `npm run db:migrate` to initialize the production schema.
4. [ ] **Asset Sync:** Run `node cloudinary_sync.js` to ensure all core institutional logos are in the cloud.
5. [ ] **SSL Verification:** Ensure HTTPS is active on `login.kucet.ac.in`.

---
**Prepared by:** Gemini CLI  
**Last Updated:** April 6, 2026

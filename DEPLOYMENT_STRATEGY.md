# KUCET CMS: Infrastructure & Deployment Strategy (2026)

## 1. Overview
This document outlines a high-performance, cost-effective deployment strategy for the KUCET College Management System. The goal is to support ~2,000+ students with 99.9% uptime while keeping monthly operational costs near zero.

---

## 2. Recommended Production Stack

| Component | Service Provider | Estimated Cost | Rationale |
| :--- | :--- | :--- | :--- |
| **Frontend/API** | **Vercel (Hobby/Pro)** | $0 - $20/mo | Native support for Next.js, Global CDN, and Auto-SSL. |
| **Database** | **TiDB Cloud (Free)** | $0/mo | 5GB MySQL-compatible storage with excellent connection pooling. |
| **Cache/Rate Limit**| **Upstash Redis** | $0/mo | Serverless Redis for distributed rate limiting and caching. |
| **Media Storage** | **Cloudinary (Free)** | $0/mo | Optimized image delivery for student photos/signatures. |
| **Custom Domain** | **Cloudflare Registrar** | ₹599/yr | Wholesale pricing with no markup and advanced security. |
| **Email Service** | **Brevo** | $0/mo | Reliable delivery for OTPs and password resets. |
| **Monitoring** | **Sentry / Datadog** | $0/mo | Real-time error tracking and performance profiling. |

---

## 3. Environment Workflow (Git-Flow)

To ensure stability, we use a three-tier environment strategy:

### A. Development (`testvanilla` branch)
*   **Purpose:** Active feature development and bug fixing.
*   **Database:** Local MySQL or Shared Development TiDB.
*   **Testing:** Manual and Unit tests.

### B. Staging (`staging` branch)
*   **Purpose:** Pre-production validation. **Mirror of Production.**
*   **Trigger:** Merging from `testvanilla` into `staging`.
*   **Actions:** Automated E2E (Playwright) and Load (k6) tests run here. Database migrations (`db:push`) MUST be tested here first.

### C. Production (`main` branch)
*   **Purpose:** Live institutional portal used by students and staff.
*   **Trigger:** Merging from `staging` into `main` after verification.
*   **Uptime:** High priority. No direct commits allowed.

---

## 4. Database Integrity & Disaster Recovery

### A. Backups & PITR
*   **Daily Backups:** Automated daily snapshots are enabled on TiDB Cloud/Railway.
*   **Point-in-Time Recovery (PITR):** **CRITICAL.** Ensure PITR is enabled in the TiDB/Railway dashboard. This allows "rewinding" the database to any specific second (e.g., 5 minutes before a clerk accidentally deleted data).

### B. Indexing & Performance
*   Regularly run query execution audits to ensure sub-100ms response times.
*   Schema changes must be synced via `npm run db:push` in staging before production.

---

## 5. Security & Scaling Considerations

### A. Traffic Spikes (Results/Admissions)
During peak hours (e.g., 500+ students marking attendance simultaneously), the **Vercel Hobby** tier may hit execution limits.
*   **Scaling Path:** Move to **Railway.app ($5/mo)** for dedicated CPU/RAM if the Free Tier throttles.

### B. Data Protection
*   **Encryption at Rest:** Sensitive fields (Aadhaar, Mobile) should be encrypted.
*   **Log Redaction:** Pino logger automatically redacts PII (Emails, Passwords) from server logs.

---

## 6. Implementation Checklist
1. [ ] **Purchase Domain:** Secure `kucet.in` or `kucet.ac.in`.
2. [ ] **Staging Setup:** Create `staging` branch and link to a staging Vercel project.
3. [ ] **PITR Enablement:** Confirm PITR is "ON" in the database provider dashboard.
4. [ ] **Production DB:** Migrate local/dev MySQL data to TiDB Cloud.
5. [ ] **Environment Variables:** Update Vercel/Hosting provider with Production DB, Redis, and Cloudinary keys.

---
**Prepared by:** Gemini CLI  
**Date:** March 20, 2026

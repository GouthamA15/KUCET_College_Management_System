# KUCET CMS: Infrastructure & Deployment Strategy (2026)

## 1. Overview
This document outlines a high-performance, cost-effective deployment strategy for the KUCET College Management System. The goal is to support ~2,000+ students with 99.9% uptime while keeping monthly operational costs near zero.

---

## 2. Recommended Production Stack

| Component | Service Provider | Estimated Cost | Rationale |
| :--- | :--- | :--- | :--- |
| **Frontend/API** | **Vercel (Hobby/Pro)** | $0 - $20/mo | Native support for Next.js, Global CDN, and Auto-SSL. |
| **Database** | **TiDB Cloud (Free)** | $0/mo | 5GB MySQL-compatible storage with excellent connection pooling. |
| **Media Storage** | **Cloudinary (Free)** | $0/mo | Optimized image delivery for student photos/signatures. |
| **Custom Domain** | **Cloudflare Registrar** | ₹599/yr | Wholesale pricing with no markup and advanced security. |
| **Email Service** | **Resend / Brevo** | $0/mo | Reliable delivery for OTPs and password resets. |
| **Monitoring** | **Sentry (Developer)** | $0/mo | Real-time error tracking and performance profiling. |

---

## 3. Domain Strategy

### Option A: Official Academic (`.ac.in`) - *Recommended*
*   **Provider:** ERNET India (Official Government Registrar).
*   **Cost:** ~₹500 - ₹1,000 / year.
*   **Requirements:** College affiliation/AICTE documents.
*   **Benefit:** Maximum institutional credibility and trust.

### Option B: Fast Commercial (`.in` / `.com`)
*   **Provider:** Cloudflare Registrar.
*   **Cost:** ~₹600 / year.
*   **Benefit:** Instant activation, no paperwork, wholesale price renewals.

---

## 4. Operational Cost Breakdown (Annual)

| Item | Affordable Path | Estimated Cost (INR) |
| :--- | :--- | :--- |
| **Domain Registration** | `kucet.in` via Cloudflare | ₹599 |
| **Hosting & SSL** | Vercel / Cloudflare | ₹0 |
| **Managed Database** | TiDB Cloud (5GB) | ₹0 |
| **CDN & Security** | Cloudflare Free | ₹0 |
| **Total Annual Cost** | | **₹599 (~$7.20 USD)** |
| **Total Monthly Cost** | | **₹50 (~$0.60 USD)** |

---

## 5. Security & Scaling Considerations

### A. Traffic Spikes (Results/Admissions)
During peak hours (e.g., 500+ students marking attendance simultaneously), the **Vercel Hobby** tier may hit execution limits.
*   **Scaling Path:** Move to **Railway.app ($5/mo)** for dedicated CPU/RAM if the Free Tier throttles.

### B. Data Protection
*   **Database Backups:** TiDB Cloud and Railway provide automated daily backups. 
*   **Encryption:** All traffic is forced over HTTPS via Cloudflare/Vercel SSL.

### C. Resource Optimization
*   **Image Handling:** We have enforced a **1MB limit** on all uploads to ensure Cloudinary's free tier (25GB) lasts for years.
*   **Connection Pool:** Our database configuration uses a pool limit of **25** to handle concurrent queries efficiently.

---

## 6. Implementation Checklist
1. [ ] **Purchase Domain:** Secure `kucet.in` or `kucet.ac.in`.
2. [ ] **Cloudflare Setup:** Point Domain Nameservers to Cloudflare for Free SSL/WAF.
3. [ ] **Production DB:** Migrate local/dev MySQL data to TiDB Cloud.
4. [ ] **Environment Variables:** Update Vercel/Hosting provider with Production DB and Cloudinary keys.
5. [ ] **Verification:** Run a final build (`npm run build`) and test the Admission Flow.

---
**Prepared by:** Gemini CLI  
**Date:** March 13, 2026

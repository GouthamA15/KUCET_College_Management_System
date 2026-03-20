# PROPOSAL: KUCET CMS Infrastructure & Deployment Strategy (2026)

**To:** The Principal, KUCET  
**From:** Development Team  
**Subject:** Selection of Production Infrastructure for College Management System  

---

## 1. Executive Summary
The KUCET College Management System (CMS) is ready for production. To ensure 99.9% uptime for our 2,000+ students and faculty, we require a robust cloud infrastructure. This proposal outlines the most cost-effective yet professional options, focusing on security, scalability, and long-term affordability.

---

## 2. Web Application Hosting (Next.js Runtime)
The frontend and API logic require a server capable of handling concurrent student traffic.

| Platform | Tier | Estimated Cost | Technical Benefits |
| :--- | :--- | :--- | :--- |
| **Vercel** | **Hobby** | ₹0 ($0) | Optimized for Next.js; easiest to deploy. |
| **Vercel** | **Pro** | ~₹1,650 ($20) /mo | Advanced security (WAF), higher bandwidth for results day. |
| **Railway.app** | **Hobby** | ~₹420 ($5) /mo | **Recommended:** No "cold starts" (always fast); fixed cost. |
| **Hetzner VPS** | **CX22** | ~₹350 ($4.2) /mo | Full dedicated server; most power for lowest price. |

---

## 3. Database Hosting (MySQL Protocol)
The database is the "heart" of the system, storing all student records, attendance, and marks.

| Platform | Tier | Estimated Cost | Reliability & Scaling |
| :--- | :--- | :--- | :--- |
| **TiDB Cloud** | **Serverless** | ₹0 ($0) | **Recommended:** High-speed MySQL; scales automatically. |
| **Railway** | **MySQL Svc** | ~₹250 ($3) /mo | Hosted with the app for ultra-low latency. |
| **DigitalOcean** | **Managed** | ~₹1,250 ($15) /mo | Pro-grade: Automated daily backups and point-in-time recovery. |
| **Aiven.io** | **Free** | ₹0 ($0) | Good for early-stage production; limited to 5 connections. |

---

## 4. Cloud Media & Document Storage
Used for storing Aadhaar cards, profile photos, signatures, and certificates.

| Platform | Capacity | Estimated Cost | Rationale |
| :--- | :--- | :--- | :--- |
| **Cloudinary** | 25 GB | ₹0 ($0) | **Recommended:** Industry leader; current system already integrated. |
| **Supabase** | 5 GB | ~₹420 ($5) /mo | Fixed cost; great for document storage beyond the free tier. |
| **Cloudflare R2** | 10 GB | ₹0 ($0) | Zero "egress" fees (you only pay for what you store). |

---

## 5. Domain & Institutional Security
Essential for branding (`kucet.ac.in`) and protecting the college from cyber-attacks.

| Component | Provider | Estimated Cost | Importance |
| :--- | :--- | :--- | :--- |
| **Academic Domain** | **ERNET India** | ~₹1,000 / yr | **Official:** Ends in `.ac.in`; builds trust with students. |
| **Public Domain** | **Cloudflare** | ~₹600 / yr | Fast activation for `.in` or `.com`. |
| **Security/WAF** | **Cloudflare** | ₹0 | Blocks hackers, spammers, and DDoS attacks for free. |

---

## 6. Recommended "Professional Budget" Bundle
This package is selected to provide the best performance for the lowest possible cost to the college.

*   **Hosting:** Railway.app (~₹420/mo)
*   **Database:** TiDB Cloud (₹0/mo)
*   **Media:** Cloudinary (₹0/mo)
*   **Domain:** ERNET .ac.in (~₹85/mo)
*   **TOTAL ESTIMATED COST:** **₹505 / month (~₹6,060 per year)**

---

## 7. Security & Compliance Note
*   **Backups:** All selected "Paid" or "Managed" options include automated backups.
*   **SSL Encryption:** All platforms provide free SSL (https://), ensuring student data is encrypted.
*   **Data Privacy:** We have implemented a 1MB file limit and PII (Personally Identifiable Information) masking in logs to ensure compliance.

---
**Approved by:** KUCET Development Team  
**Date:** March 13, 2026

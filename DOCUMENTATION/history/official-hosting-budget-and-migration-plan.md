# KUCET College Management System (CMS)
## Official Hosting Infrastructure Budget, Domain Strategy & Security Migration Plan

**Prepared For:** KUCET College Administration, Department Heads & Technical Lead
**Prepared By:** Technical Architecture & Systems Engineering Team
**Date:** July 27, 2026 — Revised August 2, 2026
**Status:** **FINAL — Hostinger KVM 2 Selected by College Administration**
**Research Sources:** Reddit (r/webhosting, r/selfhosted), Trustpilot, G2, WebsitePlanet, hostadvice.com

---

## Executive Summary

This document establishes the official procurement, domain registration, DNS delegation, and security roadmap for the **KUCET College Management System (CMS)**.

**Selected Plan: Hostinger KVM 2 VPS + kucet.in domain (3 Years)**

All financial calculations are verified directly against official checkout cart invoices (including **18% Indian GST** and coupon discounts).

---

## Section 1: Verified Cart Checkout Financials — Selected Plan

### 1.1 SELECTED — Hostinger KVM 2 + kucet.in

| Procurement Item | Duration | Base Price | Coupon | 18% GST | Final Total |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Hostinger KVM 2 (2 vCPU, 8GB RAM, 100GB NVMe, Mumbai DC) | 12 Months | Rs.10,033.20 | NETWORKCHUCK -10% | Rs.1,805.98 | **Rs.11,839.18** |
| kucet.in Domain (Yr 1: Rs.1, Yrs 2-3: Rs.899/yr via Hostinger) | 36 Months | Rs.1,799.00 | 3-Yr Promo | Rs.323.82 | **Rs.2,122.82** |
| Cloudflare Universal SSL + Email Routing | Permanent | Rs.0.00 | Free | Rs.0.00 | **Rs.0.00** |
| **GRAND TOTAL (VPS Year 1 + Domain 3yr)** | | **Rs.11,832.20** | | **Rs.2,129.80** | **Rs.13,962.00** |

### 1.2 Hostinger KVM 2 — Full Specification

- **vCPU:** 2 Cores (KVM hyperthread, Mumbai shared node)
- **RAM:** 8 GB DDR4
- **Storage:** 100 GB NVMe SSD
- **Bandwidth:** Unmetered
- **DC Location:** Mumbai, India (~15-30ms to Telangana/AP — excellent)
- **Control Panel:** hPanel (browser-based — no SSH required for basic ops)
- **Year 1 Total:** Rs.11,839.18 (with NETWORKCHUCK coupon applied)
- **Year 2 Renewal:** Rs.1,399/mo × 12 + 18% GST = Rs.19,809.84 (+67% — see mitigation below)
- **Payment:** UPI, Netbanking, RuPay, Indian Cards | GST Invoice: YES | MBG: 30 Days
- **Brand:** 20+ years, 4M+ customers, English support

> ⚠️ **Year 2 Renewal Alert:** Hostinger Year 2 renewal is Rs.19,809.84 (+67% over Year 1). Set a calendar reminder **30 days before renewal** to evaluate pricing. Lock in a multi-year plan at renewal to reduce this.

---

## Section 2: Domain Strategy

> ⚠️ **Important:** Hostinger Free Domain Voucher does NOT cover `.in` or `.co.in` domains. It only covers `.tech`, `.cloud`, `.com`, `.net`, `.org`, `.online`. For `kucet.in` you must purchase separately.

### 2.1 kucet.in — 3-Year Strategy

- **Plan:** kucet.in 3-Year on Hostinger
- **Pricing:** Year 1 = Rs.1 (promo), Years 2-3 = Rs.899/yr
- **Total:** Rs.2,122.82 (incl. 18% GST)
- **Average Annual:** Rs.707.60/year — cheapest long-term `.in` lock-in available.
- **Why 3 Years?** Prevents domain squatting, price hike risk, and renewal lapses for 36 months.

### 2.2 Dual-Domain Strategy

| Domain | Purpose | DNS Authority |
| :--- | :--- | :--- |
| kucet.in | Primary CMS Portal (`login.kucet.in`) — students, faculty, admin | Hostinger Registrar → NS to Cloudflare |
| kucet.ac.in | Existing Official College Website | GoDaddy → NS to Cloudflare |

---

## Section 3: GoDaddy DNS Migration — Troubleshooting Guide

### 3.1 Four Roadblocks & Fixes

**Roadblock 1 — Domain Lock Active:**
Fix: GoDaddy Portal → Domain Settings → Toggle Domain Lock to OFF

**Roadblock 2 — DNSSEC Enabled:**
Fix: GoDaddy DNS Management → DS Records → Delete DS Record → Wait 15 minutes

**Roadblock 3 — Editing cPanel Instead of GoDaddy Account:**
Fix: Login to primary GoDaddy Account → Domains → Manage DNS → Change NS to Cloudflare nameservers. Never edit cPanel zone files — they are not authoritative.

**Roadblock 4 — ERNET Institutional Lock on .ac.in:**
Fix: Submit formal NS delegation request to ERNET India support, OR use kucet.in as primary CMS domain.

---

## Section 4: SSL Certificate Strategy — Zero Cost Architecture

```
Browser --HTTPS--> Cloudflare Edge (Universal SSL, auto-renews 90 days, FREE)
                        |
                        | Full (Strict) Encrypted Tunnel
                        v
               Hostinger KVM 2 VPS — Mumbai DC (~15-30ms)
               (Certbot + Let's Encrypt, FREE)
                        |
                        v
               Nginx Reverse Proxy -> Next.js Port 3000
```

Setup:
1. `sudo apt install certbot python3-certbot-nginx`
2. `sudo certbot --nginx -d login.kucet.in`
3. Cloudflare Dashboard → SSL → Full (Strict)

---

## Section 5: OOM Risk Mitigation — Hostinger 8GB RAM

The primary hardware constraint of Hostinger KVM 2 is 8GB RAM. The following measures ensure the application runs safely under all load scenarios.

### 5.1 Mandatory: 4GB Swap File

A swap file acts as an overflow buffer. If Node.js, MySQL, or Redis momentarily spike past 8GB, Linux uses the SSD as overflow memory instead of killing the process.

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 5.2 Resource Allocation Guide (8GB RAM)

| Service | Allocated RAM | Configuration |
| :--- | :---: | :--- |
| MySQL 8.0 (InnoDB Buffer Pool) | ~1.5 GB | `innodb_buffer_pool_size=1536M` |
| Redis (rate-limit + sessions) | ~256 MB | `maxmemory 256mb` with `allkeys-lru` policy |
| Next.js Node.js process | ~1.5 GB | `NODE_OPTIONS=--max-old-space-size=1536` |
| Linux OS + Docker overhead | ~1 GB | Fixed |
| PDF generation headroom | ~500 MB | Limit concurrent PDF jobs to 3 max |
| **Total Reserved** | **~4.75 GB** | **3.25 GB available as buffer + swap** |

### 5.3 PDF Generation Concurrency Limit

On Hostinger 8GB, 50 simultaneous Bonafide certificate requests would spawn up to 50 PDF render jobs consuming ~7.5GB — triggering OOM. Set a concurrency limiter in the API route:

```js
// In certificate download route — limit concurrent PDF renders
const MAX_CONCURRENT_PDFS = 3;
// Use a semaphore / queue to enforce this limit
```

### 5.4 MySQL Tuning (`/etc/mysql/conf.d/kucet.cnf`)

```ini
[mysqld]
innodb_buffer_pool_size = 1536M
innodb_log_file_size = 256M
max_connections = 150
thread_cache_size = 16
query_cache_type = 0
```

---

## Section 6: Security Risk Audit

| Risk | Vulnerability | Severity | Mitigation |
| :--- | :--- | :---: | :--- |
| Financial | Hostinger Y2 +67% renewal spike → Rs.19,809.84/yr | HIGH | Set calendar reminder 30 days before expiry. Negotiate multi-year at renewal. |
| Performance | 8GB RAM OOM on result/admission day with concurrent PDF requests | HIGH | 4GB Linux Swap + PDF concurrency limiter (max 3 concurrent jobs). |
| Deliverability | VPS SMTP port 25 blacklisted — OTPs land in spam | MEDIUM | Route all email via Brevo SMTP with SPF + DKIM in Cloudflare (already configured). |
| Storage | Student photos + backups ~15-20 GB/year. 100GB fills in 5-6 years | MEDIUM | Daily Rclone sync to Google Drive (free 15GB) + weekly docker system prune. |
| Security | HTTP exposure of JWT cookies and student PII | CRITICAL | Cloudflare Full (Strict) SSL + HSTS preload via Nginx (see deployment guide). |
| Availability | Single point of failure — no hot standby | MEDIUM | Daily automated MySQL dump + Rclone offsite sync enables hours-level disaster recovery. |

---

## Section 7: Backup & Disaster Recovery

```
[KUCET CMS VPS — Hostinger Mumbai]
  |-- MySQL 8.0 -- 2:00 AM mysqldump --> /var/kucet-db-backup/db_YYYYMMDD.sql.gz
  |-- Asset Vault - 4:00 AM Rclone ---> Google Drive (15GB Free) / Cloudflare R2 (10GB Free)
```

Both backup tiers cost Rs.0. Cloudflare R2 has zero egress fees.

---

## Section 8: Final Budget Summary

### 8.1 Three-Year Cost Projection (Hostinger KVM 2)

| Year | VPS Cost | Cumulative Total |
| :---: | :---: | :---: |
| Year 1 | Rs.11,839.18 (with NETWORKCHUCK coupon) | Rs.11,839.18 |
| Year 2 | Rs.19,809.84 (full renewal rate) | Rs.31,649.02 |
| Year 3 | Rs.19,809.84 | Rs.51,459 |

| Item | Cost |
| :--- | :--- |
| kucet.in domain (3 years) | Rs.2,122.82 |
| Cloudflare SSL + Email Routing | Rs.0.00 |
| Rclone + Google Drive backup | Rs.0.00 |
| Uptime Kuma monitoring | Rs.0.00 |
| Brevo email (up to 300 emails/day) | Rs.0.00 |
| **TOTAL YEAR 1 OUTLAY** | **Rs.13,962.00** |

### 8.2 Storage Runway

| Consumer | Annual Growth | 100GB Runway |
| :--- | :---: | :---: |
| Student photo uploads | ~4 GB/yr | ~15 years |
| MySQL gzip dumps | ~0.5 GB/yr | Included |
| Docker + build cache | ~10 GB static | Included |
| Critical saturation point | | ~5-6 years (offsite sync before this) |

---

## Section 9: Complete Procurement Checklist

### 9.1 Actions to Complete

- [x] **DECISION MADE:** Hostinger KVM 2 + kucet.in selected by KUCET College Administration.
- [x] Verified Hostinger KVM 2 cart with NETWORKCHUCK coupon: Rs.11,839.18 (incl. 18% GST).
- [x] Verified kucet.in 3-Year domain cart on Hostinger: Rs.2,122.82 (incl. 18% GST).
- [x] Documented OOM mitigation strategy: 4GB swap + PDF concurrency limiter.
- [x] Documented renewal risk: Year 2 = +67% spike → Rs.19,809.84.
- [ ] **ACTION:** Purchase Hostinger KVM 2 (Mumbai DC) — apply NETWORKCHUCK coupon.
- [ ] **ACTION:** Register kucet.in (3 Years) on Hostinger → Rs.2,122.82.
- [ ] **ACTION:** GoDaddy → Domain Lock OFF + delete DNSSEC DS Record.
- [ ] **ACTION:** Change kucet.ac.in NS in GoDaddy → Cloudflare nameservers.
- [ ] **ACTION:** Add kucet.in to Cloudflare → configure A record + Universal SSL.
- [ ] **ACTION:** Set Cloudflare SSL mode → Full (Strict).
- [ ] **ACTION:** Deploy KUCET CMS stack via `DEPLOYMENT_PACKAGE/MASTER_DEPLOYMENT_GUIDE.md`.
- [ ] **ACTION:** `sudo certbot --nginx -d login.kucet.in` for Let's Encrypt origin cert.
- [ ] **ACTION:** Create 4GB swap file on VPS (see Section 5.1).
- [ ] **ACTION:** Apply MySQL RAM tuning config (see Section 5.4).
- [ ] **ACTION:** Configure + test `nightly-backup.sh` + `offsite-backup.sh` (Rclone → Drive).
- [ ] **ACTION:** Deploy Uptime Kuma for real-time downtime alerts (Telegram + Email).
- [ ] **ACTION:** Set calendar reminder 30 days before Hostinger VPS renewal date.

---

Official Document — KUCET College Management System Engineering Team
Last Updated: August 2, 2026 — Hostinger KVM 2 Selected

# KUCET College Management System — Operational Runbook & Production Guide

**Document Version:** 1.0.0 (August 7, 2026)

---

## 1. System Overview
The KUCET Management System is an enterprise Next.js platform deployed on Linux VPS (Hostinger KVM 2, Mumbai DC) backed by TiDB Cloud / MySQL and Upstash Redis.

---

## 2. Deployment Guide

### Deployment Architecture:
- **Application Server:** Node 20 LTS (Next.js standalone runner or Docker container)
- **Database:** TiDB Cloud MySQL 8.0 compliant with Range & Hash partitioning
- **Cache & Rate Limiting:** Upstash Redis with Cache-Aside TTL
- **Object Storage:** S3 / Cloudinary / Local Failover Strategy

### Automated Zero-Downtime Deployment Command:
```bash
./scripts/deployment/deploy-vps.sh
```

### Manual Docker Deployment:
```bash
docker-compose up -d --build
```

---

## 3. Emergency Rollback Guide

If post-deployment health verification fails or an operational defect is discovered:

```bash
./scripts/deployment/rollback.sh [target_commit_hash]
```

The script automatically checks out the target commit, reinstalls production dependencies, rebuilds static assets, and reloads the PM2 application process.

---

## 4. Disaster Recovery & Restoration

### Trigger Automated System Recovery:
```bash
curl -X POST http://localhost:3000/api/admin/infrastructure/disaster-recovery \
  -H "Cookie: admin_auth=YOUR_ADMIN_JWT"
```

### Manual Database Restoration CLI:
```bash
./scripts/deployment/backup-restore.sh restore /path/to/backup.sql
```

---

## 5. System Health & Infrastructure Monitoring

### Public Operational Health Probe:
`GET /api/health`
Returns JSON status with latency and component diagnostics (Database, Redis, Storage, Queue, Email, Push Notifications).

### Administrator Monitoring Dashboard Endpoint:
`GET /api/admin/infrastructure/monitoring`
Exposes real-time system metrics: Memory RSS/Heap, Uptime, Active Sessions, Total Students, DB Pool Status.

### Storage Audit & Orphan Media Cleanup:
`GET /api/admin/infrastructure/storage/audit` — Scans storage and reports unreferenced files.
`POST /api/admin/infrastructure/storage/audit` — Cleans orphan media.

---

## 6. System Maintenance Checklist

- [ ] Daily: Verify automated database snapshot completion.
- [ ] Weekly: Run `/api/admin/infrastructure/storage/audit` to prune orphan files.
- [ ] Monthly: Execute `/scripts/benchmark-system.js` to evaluate query latency.
- [ ] Quarterly: Audit SSL certificate expiration & rotatable API keys.

# Real-Time WebSocket & Redis Event Bus Architecture

**System Component:** Real-Time Subsystem  
**Implementation:** Socket.IO Server + Redis Pub/Sub Event Transport + Next.js Hybrid Provider  
**Security Model:** HTTP-Only JWT Handshake Verification & Role/User Room Isolation  

---

## 1. Overview & Objectives

The KUCET College Management System incorporates an enterprise real-time communications layer to provide instant, push-based updates across administrative, faculty, and student portals without requiring manual page refreshes or aggressive background polling loops.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  Client Applications (Admin, Staff, Faculty, Student Portals)               │
│  - Single shared Socket.IO instance via RealtimeListener                    │
│  - Automatic Cookie Authentication & Reconnection with Exponential Backoff │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ WebSocket / WSS Ingress
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Nginx Reverse Proxy (:80)                                                  │
│  - Upgrade & Connection map headers                                         │
│  - /socket.io/ -> realtime_upstream (kucet-cms-realtime:4000)                │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Dedicated Real-Time Socket Server (kucet-cms-realtime:4000)                │
│  - Handshake JWT Verification (HS256) via jose                              │
│  - Role & User Room Isolation (role:admin, dept:CSE, user:student:12)       │
│  - Health Check Endpoint (/health)                                          │
└──────────────────────────────────────▲──────────────────────────────────────┘
                                       │ Redis Pub/Sub Subscriptions
                                       │ ("kucet:realtime:events")
┌──────────────────────────────────────┴──────────────────────────────────────┐
│  Redis Ingress (kucet-cms-redis:6379)                                       │
│  - Broadcasts dispatched by Next.js API Routes & Domain Services            │
└──────────────────────────────────────▲──────────────────────────────────────┘
                                       │ RedisRealtimeProvider.broadcast()
┌──────────────────────────────────────┴──────────────────────────────────────┐
│  Next.js 16 Application Server (kucet-cms-app:3000)                         │
│  - API Routes: /api/student/requests, /api/staff/admission/drafts, etc.     │
│  - Domain Services: SecurityService, AttendanceService                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Event Namespace Matrix

All real-time events are defined canonically in `src/lib/events/realtime-events.js` and mapped transparently from legacy uppercase aliases:

| Canonical Event | Legacy Alias | Triggering Domain Action | Target Audience / Rooms |
| :--- | :--- | :--- | :--- |
| `admission:created` | `ADMISSION_DRAFT_CREATED` | Public admission registration submitted | `role:admin`, `role:admission` |
| `admission:updated` | `ADMISSION_DRAFT_UPDATED` | Admission clerk edits draft application | `role:admin`, `role:admission` |
| `admission:finalized` | `ADMISSION_DRAFT_FINALIZED` | Admission approved & enrolled | `role:admin`, `role:admission` |
| `admission:deleted` | `ADMISSION_DRAFT_DELETED` | Admission draft rejected or removed | `role:admin`, `role:admission` |
| `request:created` | `REQUEST_CREATED` | Student submits certificate/profile request | `role:admin`, `role:<clerk>`, `user:student:<id>` |
| `request:updated` | `REQUEST_UPDATED` | Clerk approves/rejects/issues request | `role:admin`, `role:<clerk>`, `user:student:<id>` |
| `staff:created` | `STAFF_CREATED` | Admin approves new staff registration | `role:admin` |
| `staff:updated` | `STAFF_UPDATED` | Profile edited / role updated | `role:admin`, `user:staff:<id>` |
| `staff:status-changed` | `STAFF_STATUS_CHANGED` | Staff activated / deactivated | `role:admin`, `user:staff:<id>` |
| `staff:registration:created` | `STAFF_REGISTRATION_CREATED` | Self-registration submitted | `role:admin` |
| `student:photo:updated` | `PROFILE_PHOTO_UPDATED` | Student uploads ID photo | `role:admin`, `role:admission`, `user:student:<id>` |
| `student:stats:updated` | `STUDENT_STATS_UPDATED` | Admissions/enrollment change | `role:admin` |
| `academic:timetable:changed`| `TIMETABLE_CHANGED` | HOD modifies semester timetable | `dept:<branch>`, `role:admin` |
| `attendance:session:started`| `SESSION_STARTED` | Faculty initiates attendance session | `dept:<branch>` |
| `attendance:student:verified`| `STUDENT_VERIFIED` | Student verifies PIN & GPS | `role:faculty`, `dept:<branch>` |
| `attendance:proxy:attempted`| `PROXY_ATTEMPTED` | Device/IP mismatch detected | `role:faculty` |
| `notification:created` | `SECURITY_NOTIFICATION_CREATED` | Security event / session change | `user:<role>:<id>` |

---

## 3. Security & Room Isolation

1. **Authentication during Handshake:** Socket.IO connection handshakes extract session cookies (`admin_auth`, `staff_auth`, `student_auth`) and verify JWT signatures with `JWT_SECRET`. Unauthenticated connections are rejected.
2. **Room Assignment:**
   - `admin`: Joins `role:admin`, `channel:admissions`, `channel:requests`, `channel:staff`, `channel:students`, `channel:stats`, `user:admin:<id>`.
   - `staff`: Joins `role:staff`, `role:<role>`, `dept:<branch>`, `user:staff:<id>`.
   - `student`: Joins `role:student`, `student:<roll_no>`, `user:student:<id>`.
3. **Zero PII in Real-Time Broadcasts:** Payloads broadcast only resource IDs and event types (e.g. `{ id: 123, type: 'BONAFIDE' }`). Clients refetch detailed entities through authorized, Zod-validated API routes.

---

## 4. Containerization & Production Resilience

- Dedicated Docker service `kucet-cms-realtime` running Alpine Node 20 on port 4000.
- Docker Compose configured with `restart: unless-stopped` and active HTTP `/health` healthcheck.
- Nginx reverse proxy routes `/socket.io/` with `Upgrade` and `Connection` headers and `proxy_read_timeout 86400s`.

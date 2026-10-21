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
| `chess:move:played` | `CHESS_MOVE_PLAYED` | Chess player plays move on board | `match:<matchId>`, `student:<white>`, `student:<black>` |
| `chess:game:over` | `CHESS_GAME_OVER` | Checkmate / Stalemate / Resignation / Draw | `match:<matchId>` |
| `chess:action` | `CHESS_ACTION` | Draw offer / Resignation / Timeout | `match:<matchId>` |
| `tournament:updated` | `TOURNAMENT_UPDATED` | Fixtures generated / Round advanced | `role:admin`, `role:student` |

---

## 3. Security & Room Isolation

1. **Authentication during Handshake:** Socket.IO connection handshakes extract session cookies (`admin_auth`, `staff_auth`, `student_auth`) or Bearer authorization headers and verify JWT signatures via `jose` using `JWT_SECRET`. Unauthenticated connections are rejected immediately with HTTP 401.
2. **Room Assignment:**
   - `admin`: Automatically joins `role:admin`, `channel:admissions`, `channel:requests`, `channel:staff`, `channel:students`, `channel:stats`, `user:admin:<id>`.
   - `staff`: Automatically joins `role:staff`, `role:<role>`, `dept:<branch>`, `user:staff:<id>`.
   - `student`: Automatically joins `role:student`, `student:<roll_no>`, `user:student:<id>`.
3. **Zero PII in Real-Time Broadcasts:** Payloads broadcast only resource IDs and event types (e.g. `{ id: 123, type: 'BONAFIDE' }`). Clients refetch detailed entities through authorized, Zod-validated API routes.

---

## 4. Frontend Singleton Management (`RealtimeListener.js`)

To prevent multiple redundant WebSocket connections and memory leaks across page navigations, the client uses a resilient singleton pattern:

1. **Shared Socket Connection:** A single Socket.IO client instance (`sharedSocket`) is created and reused across all mounted React components and contexts.
2. **Dynamic Subscription Handlers:** Components register event callbacks using `registerHandler(event, callback)`. When components unmount, callbacks are cleanly detached from the subscriber set without closing the underlying socket.
3. **Automatic Silent Auth Recovery:** On `connect_error` or authentication expiration, `RealtimeListener` coordinates with `proxy.js` to refresh tokens and seamlessly reconnect.
4. **Exponential Backoff:** Reconnection uses randomized exponential backoff (`reconnectionDelay: 1000`, `reconnectionDelayMax: 5000`) to avoid thundering herd reconnection storms.

---

## 5. CircuitBreaker & Database-First Invariant

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       DATABASE SOURCE OF TRUTH INVARIANT                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. All entity mutations MUST commit to MySQL/TiDB first.                   │
│ 2. Realtime broadcast is published only AFTER successful transaction commit.│
│ 3. If Redis/Socket server is unreachable, CircuitBreaker catches the error  │
│    and logs a warning, allowing the HTTP API response to return 200 OK.     │
└─────────────────────────────────────────────────────────────────────────────┘
```

1. **Transaction Independence:** Realtime broadcasting never blocks database transactions. If `RedisRealtimeProvider.broadcast()` fails, the database write remains committed and intact.
2. **CircuitBreaker Integration:** The Redis client in `src/providers/realtime/RedisRealtimeProvider.js` is wrapped in a `CircuitBreaker`. When Redis is down or unreachable, the circuit opens, failing fast without incurring connection timeouts on user requests.

---

## 6. Containerization & Production Resilience

- **Dedicated Service:** Docker service `kucet-cms-realtime` running Alpine Node 20 on port 4000 (`DEPLOYMENT_PACKAGE/CONFIGS/socket-server.js`).
- **Health Probing:** Docker Compose configured with `restart: unless-stopped` and active HTTP `/health` healthcheck probing every 10 seconds.
- **Nginx Ingress Routing:** Nginx reverse proxy maps `/socket.io/` to `realtime_upstream:4000` with WebSocket upgrade headers (`Upgrade: $http_upgrade`, `Connection: "upgrade"`) and `proxy_read_timeout 86400s`.
- **Remote HTTPS Ingress:** Remote clients connecting through public Tailscale Funnel connect to same-origin `wss://.../socket.io/` without exposing raw port 4000 to the public internet.

---

## 7. Modular Provider Architecture (`factory.js`)

In Session 224 (Commit `0ae54de8`), the real-time subsystem was modularized under `src/lib/providers/realtime/`:

```
src/lib/providers/realtime/
├── RealtimeProvider.js        # Abstract contract (broadcast(type, payload, options))
├── RedisRealtimeProvider.js   # Authoritative self-hosted VPS provider (ioredis pub/sub to Socket.IO)
├── SupabaseRealtimeProvider.js# Cloud-native fallback (Supabase Broadcast via @supabase/supabase-js)
├── HybridRealtimeProvider.js  # Multi-provider fanout (dispatches to both Redis & Supabase simultaneously)
└── factory.js                 # Environment-driven singleton factory (getRealtimeProvider())
```

### Provider Precedence & Configuration
Configured via `REALTIME_PROVIDER` or `NEXT_PUBLIC_REALTIME_PROVIDER`:
- **`socketio`** (or **`redis`**, default): Uses `RedisRealtimeProvider` connecting to `REDIS_URL` (`redis://127.0.0.1:6379`). Publishes events to Redis channel `kucet:realtime:events` which the Socket.IO server distributes to connected client sockets.
- **`supabase`**: Uses `SupabaseRealtimeProvider` connecting to `NEXT_PUBLIC_SUPABASE_URL` with `SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Broadcasts on channel `kucet-updates`. Throws clear configuration error if credentials are absent.
- **`hybrid`**: Uses `HybridRealtimeProvider` to fan out broadcasts to both Redis and Supabase. If Supabase credentials are not supplied, logs a warning and proceeds with Socket.IO only.

### Strict Targeted Room Isolation (`resolveEventRooms`)
To prevent accidental broadcast leakage across unrelated users, `src/lib/events/realtime-events.js` implements `resolveEventRooms(event, payload, options)`:
- Examines canonical event name and payload identifiers (`student_id`, `roll_no`, `branch`, `role`, `matchId`).
- Maps events strictly to authorized room targets (e.g., student requests only target `role:admin`, `channel:requests`, and `user:student:<id>`).
- If no explicit room is targeted and `isPublic` is false, `socket-server.js` suppresses the broadcast, preventing security exposure.

---

## 8. Forensic Audit Findings & Integration Status

During the comprehensive Session 224 feature audit, the following integration discrepancies were identified:

| Subsystem | Intended Behavior | Actual Code State | Impact / Runtime Behavior | Status | Recommended Repair |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Supabase Client Listener** | Frontend subscribes to Supabase Realtime when `REALTIME_PROVIDER=supabase` | `RealtimeListener.js` only imports and connects to `socket.io-client`. No client-side Supabase subscription exists anywhere in frontend code. | If `REALTIME_PROVIDER=supabase` is set, server broadcasts to Supabase channel `kucet-updates`, but no browser receives it. | **BROKEN (when supabase selected)** | When `REALTIME_PROVIDER=supabase`, implement client Supabase channel listener or maintain Socket.IO as primary client transport. |
| **Chess Match Room Join** | `ChessGameView` joins `match:<matchId>` room via Socket.IO for 0-latency move pushes | `socket-server.js` listens to `join_match` event, but `ChessGameView.js` / `RealtimeListener.js` never emits `join_match`. `sharedSocket` is private in `RealtimeListener`. | Multi-tier Layer 1 (Socket.IO) does not receive room moves. Feature relies on Layer 2 (`BroadcastChannel` for same-browser tabs) and Layer 3 (5-second safety poll). | **PARTIALLY WORKING** | Export `joinMatchRoom(matchId)` from `RealtimeListener.js` and call it on `ChessGameView` mount. |
| **Domain EventBus Coverage** | `CentralDomainEventBus` publishes 8 academic domain events | Only `ATTENDANCE_SUBMITTED` and `FEE_PAID` are actively published in route handlers. `TOPIC_UPDATED`, `MARKS_PUBLISHED`, `STUDENT_REGISTERED`, `ARCHIVE_COMPLETED`, `STUDENT_RESTORED`, `CERTIFICATE_ISSUED` are uncalled stubs. | Internal in-memory pub/sub only triggers cache invalidation for attendance and fee payment. Other domains rely on standard direct cache invalidations. | **PARTIALLY WORKING** | Wire remaining domain event publishers into corresponding services or consolidate unused event types. |


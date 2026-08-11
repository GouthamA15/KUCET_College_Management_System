# Session Management & Remote Revocation

## Overview

The KUCET CMS maintains a stateful session orchestration layer powered by `SecurityService.js` and the `user_sessions` database table. While JWT tokens enable fast stateless edge authentication, the session management system provides real-time security tracking, hardware heuristic analysis, device-level session listing, and immediate remote session revocation.

---

## Active Session Schema (`user_sessions`)

Every authenticated login (for Clerks, Faculty, HODs, and Super Admins) creates or updates an active session record in `user_sessions`.

| Column Name | Data Type | Nullable | Description / Usage |
| :--- | :--- | :---: | :--- |
| `id` | `INT` | ❌ | Primary Key (Auto-Increment) |
| `user_id` | `INT` | ❌ | Foreign Key referencing User Table ID (`clerks.id` or `principal.id`) |
| `user_type` | `VARCHAR(50)` | ❌ | User Domain (`CLERK`, `FACULTY`, `HOD`, `ADMIN`) |
| `session_token_hash` | `VARCHAR(255)` | ❌ | SHA-256 Digest of the active refresh token |
| `browser` | `VARCHAR(100)` | 🔐 | Extracted User-Agent Browser Name (e.g., Chrome 124) |
| `operating_system` | `VARCHAR(100)` | 🔐 | Extracted OS (e.g., Windows 11, macOS, Android) |
| `device_name` | `VARCHAR(100)` | 🔐 | Extracted Device Name or Hardware Heuristic |
| `ip_address` | `VARCHAR(45)` | 🔐 | Client IPv4 or IPv6 Address |
| `location` | `VARCHAR(100)` | 🔐 | Geolocation / IP Lookup String |
| `is_current` | `BOOLEAN` | ❌ | Flag indicating if this session is the active browser session |
| `is_revoked` | `BOOLEAN` | ❌ | Revocation status (1 = Revoked, 0 = Active) |
| `last_seen_at` | `DATETIME` | ❌ | Timestamp of last API interaction or token refresh |
| `created_at` | `DATETIME` | ❌ | Session creation timestamp |
| `expires_at` | `DATETIME` | ❌ | Expiration timestamp matching refresh token validity |

---

## Device Heuristics & New Device Detection

When a user logs in, `SecurityService.detectNewDevice()` parses the incoming User-Agent header via `parseUA()` to extract hardware and browser signatures.

```mermaid
flowchart TD
    A[Incoming Login Request] --> B[Parse User-Agent & IP Address]
    B --> C{Search user_sessions for matching user_id, browser, and OS}
    C -->|Found Match| D[Update Existing Device Session & last_seen_at]
    C -->|No Match Found| E[Flag as NEW_DEVICE_LOGIN]
    E --> F[Insert New Session Record in user_sessions]
    E --> G[Create Security Notification in DB]
    E --> H[Trigger Async Security Alert Email via Brevo API]
```

---

## Session Revocation Architecture

Users can view and manage their active sessions from their profile Security Center. Remote revocation operates in real time using Server-Sent Events (SSE).

### 1. Single Session Revocation (`SecurityService.revokeSession`)
Terminates a specific session ID:
```javascript
await SecurityService.revokeSession({ userType: 'CLERK', userId: 12, sessionId: 45 });
```
**Execution Workflow**:
1. Verifies session ownership (`id`, `user_id`, `user_type`).
2. Updates database record: `is_revoked = true`, `is_current = false`.
3. Dispatches `SESSION_REVOKED` security event log and triggers background alert email to user.
4. Creates a `WARNING` security notification in `security_notifications`.
5. Broadcasts real-time SSE event `SESSION_REVOKED` containing `sessionId`, `userId`, `userType`.

### 2. Revoke All Other Sessions (`SecurityService.revokeOtherSessions`)
Terminates all active sessions for a user **except** the current session:
```javascript
await SecurityService.revokeOtherSessions({
  userType: 'ADMIN',
  userId: 1,
  currentTokenHash: 'sha256_hash_of_current_refresh_token'
});
```
**Execution Workflow**:
1. Queries `user_sessions` for all active (`is_revoked = false`) records matching `user_id` and `user_type` where `session_token_hash != currentTokenHash`.
2. Executes bulk DB update setting `is_revoked = true` and `is_current = false`.
3. Dispatches `OTHER_SESSIONS_REVOKED` security event.
4. Broadcasts individual SSE revocation events for each terminated session ID.

---

## Security Guards & Revocation Protection

To prevent session hijacking or invalid state transitions, `SecurityService.js` enforces strict safety guards:

### 1. Reactivation Protection Guard
If an incoming refresh request attempts to update a session that has already been flagged `is_revoked: true`, `SecurityService.updateSession` explicitly rejects the request and logs `[SESSION_REACTIVATION_ATTEMPT]`.

### 2. Session Ownership Validation Guard
If the `userId` or `userType` of an incoming update request does not match the stored session record in `user_sessions`, the system logs `[SESSION_OWNERSHIP_MISMATCH]` and forces the creation of a brand new isolated session record.

### 3. Real-Time Client Synchronization
The client browser stores a non-httpOnly companion cookie `*_session_id` (`clerk_session_id`, `admin_session_id`). Client components establish an SSE event listener to `/api/events`. When a `SESSION_REVOKED` broadcast matching the client's `session_id` is received, the client immediately clears local state and redirects to the login screen with a security alert message.

---

## Cross-References

- [Authentication Architecture](./authentication.md)
- [Authorization System](./authorization.md)
- [Student Portal Security Center](../pages/student-pages.md#security-center)
- [Database Schema (Security Domain)](../database/schema.md#6-security-domain)

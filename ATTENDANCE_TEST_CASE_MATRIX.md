# Attendance Achievement System — Test Case Matrix

**Branch:** `testvanilla` | **Code Commit:** `7b4f20a2816f2a72184e725ba6a3b01195903a9d`

---

## 1. Attendance & Streak Business Logic (A01–A20)

| Case | Scenario | Verification Source | Status |
|---|---|---|---|
| A01–A04 | Single session, 5-session streak, cross-date continuity, miss reset | `attendance-streak-engine.test.js`, `attendance-streak-comprehensive-audit.test.js` | **PASSED** |
| A05 | Unfinalized session excluded | `attendance-streak-comprehensive-audit.test.js` | **PASSED** |
| A06–A09 | `PRESENT`, `NCC`, `MEDICAL` increment; `ABSENT`/unknown break | `attendance-security-and-lifecycle.test.js`, `attendance-streak-engine.test.js` | **PASSED** |
| A10–A13 | Pre/post-finalization updates, `ABSENT->PRESENT` & `PRESENT->ABSENT` disputes | `attendance-achievement-phase2.test.js`, `attendance-streak-comprehensive-audit.test.js` | **PASSED** |
| A14–A15 | Repeated/concurrent session & dispute idempotency | `attendance-achievement-phase2.test.js` | **PASSED** |
| A16–A20 | Empty history, term/subject isolation, malformed status, backfill determinism | `attendance-security-and-lifecycle.test.js`, `attendance-milestones-unlock-and-history-order.test.js` | **PASSED** |

---

## 2. Milestones & Custom Emojis (M01–M12)

| Case | Scenario | Verification Source | Status |
|---|---|---|---|
| M01–M04 | Below, exact, above, and multi-threshold unlocks (`5..200`) | `attendance-milestones-and-emojis.test.js`, `attendance-milestones-unlock-and-history-order.test.js` | **PASSED** |
| M05–M06 | Idempotent unlock & duplicate prevention | `attendance-achievement-phase2.test.js` | **PASSED** |
| M07–M08 | Downward reconciliation & restoration policy | `attendance-achievement-phase2.test.js` | **PASSED** |
| M09–M12 | Invalid milestone ID, cross-student denial, invalid emoji, missing config | `student-attendance-streak-security.test.js`, `attendance-security-and-lifecycle.test.js` | **PASSED** |

---

## 3. Goals, Analytics, Calendar, Notifications & Security (S01–S15)

| Area | Verification Source | Status |
|---|---|---|
| Personal Goals (CRUD, bounds `1..1000`, authoritative progress, IDOR) | `attendance-security-and-lifecycle.test.js`, `attendance-achievement-phase2.test.js` | **PASSED** |
| Analytics & Calendar (leap year Feb 29, empty state, date filters, `DESC` order) | `attendance-security-and-lifecycle.test.js`, `attendance-milestones-unlock-and-history-order.test.js` | **PASSED** |
| Notifications & Socket.IO / Push (unit/mocked) | `attendance-achievement-phase2.test.js`, `realtime-system.test.js` (23/23), `PushNotificationService.test.js` (4/4) | **PASSED** |
| API Security (`401` unauth, forged `student_id`, bounded `limit<=100`, invalid JSON `400`, invalid `assignment_id` `400`) | `attendance-security-and-lifecycle.test.js`, `student-attendance-streak-security.test.js` | **PASSED** |
| Live TiDB, Cloudinary, Authenticated Browser E2E, Live Socket.IO/Redis/VAPID | Offline sandbox / production isolation | **BLOCKED (Staging Required)** |

# KUCET CMS — Attendance Streaks & Achievement Module Architecture Audit

**Branch:** `testvanilla`  
**Base Commit Audited:** `94d556aba4af92c1a45ac8ffa29a036e4a1e5171`  
**Runtime Stack:** Node.js `v26.13.0`, npm `12.2.1`, Next.js `16.3.3` (App Router), Drizzle ORM `0.45.1`, `mysql2` `3.16.0`, Socket.IO `4.8.4`, `ioredis` `5.10.1`, Vitest `4.1.12`, Playwright `1.58.2`.

---

## 1. End-to-End Dependency & Data Flow Map

```text
Student / Faculty Identity (HTTP-only JWT via getAuthUser('student' | 'faculty' | 'admin'))
  └─> Authenticated API Request (/api/student/attendance/*, /api/staff/faculty/attendance/disputes/[id], /api/admin/attendance/streak-milestones)
        └─> Attendance Records + Finalized Class Sessions (student_attendance, attendance_sessions, branch_timetable, subject_assignments, lab_batch_allocations)
              └─> Eligibility & Chronological Ordering (StreakService.calculateStudentStreak -> date ASC, sessionNumber ASC, sessionId ASC)
                    └─> Policy Evaluation (getServerStreakPolicy() -> EXCUSED_INCREMENTS: PRESENT, NCC, MEDICAL increment; ABSENT breaks)
                          ├─> Milestone Evaluation & Idempotent Unlock (attendance_streak_milestones, student_streak_unlocks)
                          ├─> Custom Emoji Selection & Preferences (student_streak_preferences)
                          ├─> Personal Goals Sync (GoalAndNotificationService.syncGoalsWithStreakData -> student_attendance_goals)
                          ├─> Analytics & Calendar Aggregation (computeAttendanceAnalytics, computeMonthlyCalendarSummary)
                          ├─> Audit & Reconciliation Logs (attendance_audit_logs, student_streak_reconciliation_logs)
                          └─> Zero-Email Multi-Channel Notifications (GoalAndNotificationService.createIdempotentNotification)
                                ├─> DB Inbox (student_streak_notifications, UNIQUE(student_id, event_key))
                                ├─> Room-Scoped Socket.IO (broadcastUpdate(..., { room: 'student:<id>' }))
                                └─> Optional PWA Web Push (PushNotificationService.sendToRecipients -> public/sw.js)
                                      └─> UI Sync (StudentContext.js -> AcademicAttendanceTimeline, AttendanceStreakCard, StreakRewardsModal, AttendanceCalendarPanel, AttendanceAnalyticsAndGoalsPanel)
```

---

## 2. Module Inventory

### 2.1 Database Tables & Migrations
- **Tables (`src/db/schema/streaks.js`):**
  1. `attendance_streak_milestones`
  2. `student_streak_unlocks` (`uq_student_milestone_unlock`)
  3. `student_streak_preferences`
  4. `student_attendance_goals`
  5. `student_streak_notifications` (`uq_ssn_student_event`)
  6. `student_streak_reconciliation_logs`
- **Migrations:**
  - `drizzle/0035_attendance_streaks_and_custom_emojis.sql` (core milestone, unlock, preference tables + indexes)
  - `drizzle/0036_seed_default_streak_milestones.sql` (idempotent 9-tier milestone seed `5..200` via `ON DUPLICATE KEY UPDATE`)
  - `drizzle/0037_achievement_goals_notifications_reconciliation.sql` (`reminders_enabled` column + goals, notifications, reconciliation log tables)

### 2.2 API Endpoints & Permission Boundaries
| Endpoint | Auth Role | Purpose | Key Guards |
|---|---|---|---|
| `GET /api/student/attendance/streak` | `student` | Current/longest streak, milestones, selected emoji | `getAuthUser('student')`, server-side policy only |
| `GET /api/student/attendance/streak/history` | `student` | Latest-first attendance timeline (`DESC`) + filters + pagination | `getAuthUser('student')`, bounded `limit <= 100` |
| `POST /api/student/attendance/streak/select-emoji` | `student` | Select unlocked custom emoji | `getAuthUser('student')`, Zod + unlock ownership check |
| `GET /api/student/attendance/analytics` | `student` | Trends, subject insights, recognition badges, calendar | `getAuthUser('student')`, date/subject filters |
| `GET/POST/PUT/DELETE /api/student/attendance/goals` | `student` | Personal goals CRUD | `getAuthUser('student')`, Zod `target_value` `1..1000`, `student_id` scoped |
| `GET/PATCH /api/student/attendance/notifications` | `student` | Notification inbox, mark read, reminder toggle | `getAuthUser('student')`, bounded `limit <= 100`, `400` on invalid JSON |
| `GET /api/student/attendance/history` | `student` | Subject-level latest-first attendance history | `getAuthUser('student')`, positive int `assignment_id` check |
| `PATCH /api/staff/faculty/attendance/disputes/[id]` | `faculty` | Approve/reject attendance disputes & trigger streak reconciliation | Faculty assignment ownership, DB transaction + pre-tx baseline |
| `GET/POST/PUT/DELETE /api/admin/attendance/streak-milestones` | `admin` | Configure milestone tiers | `wrapHandler({ auth: 'admin' })`, Zod + `logAudit` |

### 2.3 Services & Shared Config
- `src/lib/streak-config.js`: `STREAK_ATTENDANCE_POLICIES`, `getServerStreakPolicy()`, `evaluateAttendanceStatus()`, `DEFAULT_STREAK_MILESTONES`, `sortTimelineDescending()`, `computeAttendanceAnalytics()`, `computeMonthlyCalendarSummary()`.
- `src/services/attendance/StreakService.js`: `calculateStudentStreak()`, `updateSelectedEmoji()`, `reconcileStudentAfterCorrection()`.
- `src/services/attendance/GoalAndNotificationService.js`: `createGoal()`, `updateGoal()`, `syncGoalsWithStreakData()`, `createIdempotentNotification()`, `getStudentNotifications()`, `markNotificationsRead()`.

### 2.4 Real-Time, Push & UI Components
- **Real-time:** `src/lib/sse.js` (`broadcastUpdate` -> Socket.IO + Redis adapter on `kucet-cms-realtime:4000`), `src/context/StudentContext.js` (`STREAK_NOTIFICATION_CREATED`, `ATTENDANCE_DISPUTE_APPROVED`).
- **Web Push:** `src/services/security/PushNotificationService.js` + `/api/notifications/subscribe` + `public/sw.js`.
- **UI Components:** `AttendanceStreakCard.js`, `StreakRewardsModal.js`, `AcademicAttendanceTimeline.js`, `AttendanceCalendarPanel.js`, `AttendanceAnalyticsAndGoalsPanel.js`.

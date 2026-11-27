# KUCET Attendance Streaks, Achievements & Custom Emoji Rewards

## 1. Feature Architecture Overview

The **Attendance Streak & Achievement System** integrates with the existing attendance engine of the KUCET College Management System. It tracks consecutive classes attended across daily timetable periods, displays current streaks and personal bests, integrates a persistent indicator beside the profile picture on mobile, and provides an expandable milestone tier framework for unlocking custom emojis.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ATTENDANCE STREAK ENGINE ARCHITECTURE                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [attendance_sessions] (Authoritative Conducted Sessions: submitted_at != null)
│           │                                                                 │
│           ├──> [Batch-Aware Filter: batch_number == 0 || allocatedBatch]     │
│           │                                                                 │
│           ▼                                                                 │
│  [student_attendance] (Finalized Records: PRESENT, ABSENT, NCC, MEDICAL)    │
│           │                                                                 │
│           ▼                                                                 │
│  [StreakService.calculateStudentStreak]                                     │
│     • Chronological Sort: attendance_date ASC, session_number ASC           │
│     • Deterministic walk: PRESENT/NCC/MEDICAL -> streak++, ABSENT -> 0       │
│     • Metrics: currentStreak, longestStreak, previousStreak, timeline       │
│           │                                                                 │
│           ├──> [streak-config.js / attendance_streak_milestones]            │
│           │       (Milestone Progress & Unlocked Tiers)                     │
│           │                                                                 │
│           ▼                                                                 │
│  [Student UI Ecosystem]                                                     │
│     • MobileTopbar: Streak Pill Beside User Avatar (🔥 12)                  │
│     • StudentDashboardClient: AttendanceStreakCard & Banner Chip            │
│     • Academics Tab: AcademicAttendanceTimeline (Full Class History)        │
│     • StreakRewardsModal: Emoji Collection & Selection                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Business Rules & Attendance Semantics

1. **Class-Based, Not Day-Based**: Streaks depend strictly on consecutive **classes attended**, not consecutive calendar days. Four classes attended across different periods on the same day count as four. A weekend or holiday gap does not break a streak if no scheduled class was held.
2. **Authoritative Finalization Invariant**:
   - Only sessions in `attendance_sessions` with `submitted_at IS NOT NULL` are considered conducted and eligible.
   - Pending sessions (`submitted_at IS NULL`) are ignored and **never** counted as absences.
   - Cancelled classes (where no session was conducted) do not break the streak.
3. **Class Ordering**: Classes are ordered chronologically by `attendance_date ASC, session_number ASC, id ASC`. `session_number` is the college timetable period (1 to 8).
4. **Attendance Statuses**:
   - `PRESENT`, `NCC` (Duty Leave), `MEDICAL` (Excused Medical Leave): Increments the current streak by 1.
   - `ABSENT` or `UNRECORDED` (student has no record for a conducted cohort/batch class): Resets the current streak to 0, preserves the previous streak value, and records the break.
5. **Personal Best (`longestStreak`)**: The highest verified streak ever achieved in the sequence is preserved across resets.
6. **Historical Recalculation**: If faculty corrects attendance (or a student attendance dispute is approved), the chronological sequence is re-evaluated across the finalized state, ensuring 100% deterministic accuracy.

---

## 3. Database Schema (Migration `0035`)

### Tables
1. **`attendance_streak_milestones`**:
   - `id`: INT AUTO_INCREMENT PRIMARY KEY
   - `milestone_code`: VARCHAR(50) UNIQUE (e.g. `STREAK_10`)
   - `title`: VARCHAR(100)
   - `description`: TEXT
   - `required_streak`: INT
   - `emoji_code`: VARCHAR(50)
   - `emoji_char`: VARCHAR(16) DEFAULT `'🔥'`
   - `asset_url`: VARCHAR(500) NULL
   - `display_order`: INT DEFAULT 0
   - `is_active`: BOOLEAN DEFAULT TRUE
2. **`student_streak_unlocks`**:
   - `id`: INT AUTO_INCREMENT PRIMARY KEY
   - `student_id`: INT (FK `students.id`)
   - `milestone_id`: INT (FK `attendance_streak_milestones.id`)
   - `verified_streak`: INT
   - `unlocked_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   - UNIQUE KEY: `uq_student_milestone_unlock (student_id, milestone_id)`
3. **`student_streak_preferences`**:
   - `student_id`: INT PRIMARY KEY (FK `students.id`)
   - `selected_emoji_char`: VARCHAR(16) DEFAULT `'🔥'`
   - `selected_emoji_code`: VARCHAR(50) DEFAULT `'fire'`
   - `selected_milestone_id`: INT NULL

### Production Safety & Rollback
- To deploy schema to production: `npm run db:migrate` (requires explicit user authorization).
- Rollback SQL:
  ```sql
  DROP TABLE IF EXISTS `student_streak_preferences`;
  DROP TABLE IF EXISTS `student_streak_unlocks`;
  DROP TABLE IF EXISTS `attendance_streak_milestones`;
  DELETE FROM `__drizzle_migrations` WHERE `hash` = '' AND `created_at` = 1791300000000;
  ```

---

## 4. API Endpoints

1. `GET /api/student/attendance/streak`:
   - Summary of student streak metrics, next milestone, selected emoji, and unlocked milestones.
2. `GET /api/student/attendance/streak/history`:
   - Chronological class-by-class attendance history with streak-after-class state.
   - Query filters: `subject_code`, `status` (`PRESENT`, `ABSENT`).
3. `POST /api/student/attendance/streak/select-emoji`:
   - Updates student active emoji.
   - Server validates student ownership of custom milestone emojis before selection.

---

## 5. UI Components

1. **`MobileTopbar.js`**: Renders a dedicated streak indicator pill (`🔥 12`) directly beside the student avatar on mobile screens (`< 1024px`), clicking which navigates to the attendance timeline.
2. **`AttendanceStreakCard.js`**: Summary card on `/student` dashboard showing Current Streak, Personal Best, Conducted Classes ratio, and Next Milestone progress.
3. **`AcademicAttendanceTimeline.js`**: Located under `/student/academics?tab=attendance`. Provides a toggle between chronological class-by-class attendance history and subject-wise distribution bar chart.
4. **`StreakRewardsModal.js`**: Modal displaying active emoji, unlocked milestone tiers, and selection controls.

-- Migration: 0039_safe_attendance_archive_and_snapshots.sql
-- Description: Non-destructive logical attendance archiving, enum alignment, session link preservation, and derived streak snapshot table.
-- Structured as single-operation DDL statements for TiDB Serverless & MySQL 8.0 compatibility.

ALTER TABLE `students` ADD COLUMN `is_archived` boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE `students` ADD COLUMN `archive_batch_id` varchar(64) NULL;
--> statement-breakpoint
ALTER TABLE `students` ADD COLUMN `archived_at` timestamp NULL;
--> statement-breakpoint
CREATE INDEX `idx_students_archived` ON `students` (`is_archived`);
--> statement-breakpoint

ALTER TABLE `student_attendance` ADD COLUMN `is_archived` boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE `student_attendance` ADD COLUMN `archive_batch_id` varchar(64) NULL;
--> statement-breakpoint
ALTER TABLE `student_attendance` ADD COLUMN `archived_at` timestamp NULL;
--> statement-breakpoint
ALTER TABLE `student_attendance` ADD COLUMN `record_version` int NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `student_attendance` ADD COLUMN `last_modified_by` int NULL;
--> statement-breakpoint
ALTER TABLE `student_attendance` ADD COLUMN `last_modified_at` timestamp NULL ON UPDATE CURRENT_TIMESTAMP;
--> statement-breakpoint
CREATE INDEX `idx_sa_streak_scan` ON `student_attendance` (`student_id`, `date`, `session`, `status`);
--> statement-breakpoint
CREATE INDEX `idx_sa_assignment_archived_date` ON `student_attendance` (`assignment_id`, `is_archived`, `date`);
--> statement-breakpoint
CREATE INDEX `idx_sa_archive_batch` ON `student_attendance` (`archive_batch_id`);
--> statement-breakpoint

ALTER TABLE `attendance_sessions` ADD COLUMN `is_archived` boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE `attendance_sessions` ADD COLUMN `archive_batch_id` varchar(64) NULL;
--> statement-breakpoint
ALTER TABLE `attendance_sessions` ADD COLUMN `archived_at` timestamp NULL;
--> statement-breakpoint
CREATE INDEX `idx_as_assignment_archived_sub` ON `attendance_sessions` (`assignment_id`, `is_archived`, `submitted_at`);
--> statement-breakpoint
CREATE INDEX `idx_as_archive_batch` ON `attendance_sessions` (`archive_batch_id`);
--> statement-breakpoint

ALTER TABLE `student_attendance_disputes` ADD COLUMN `is_historical_override` boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE `student_attendance_disputes` ADD COLUMN `attendance_source` varchar(20) NOT NULL DEFAULT 'ACTIVE';
--> statement-breakpoint

CREATE UNIQUE INDEX `uq_archive_students_orig_id` ON `archive_students` (`original_student_id`);
--> statement-breakpoint

ALTER TABLE `archive_student_attendance` ADD COLUMN `session_id` int NULL AFTER `original_attendance_id`;
--> statement-breakpoint
ALTER TABLE `archive_student_attendance` ADD COLUMN `archive_batch_id` varchar(64) NULL AFTER `device_fingerprint`;
--> statement-breakpoint
ALTER TABLE `archive_student_attendance` MODIFY COLUMN `status` enum('PRESENT','ABSENT','NCC','MEDICAL','EXEMPTED') NOT NULL DEFAULT 'PRESENT';
--> statement-breakpoint
CREATE INDEX `idx_archive_att_session` ON `archive_student_attendance` (`session_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_archive_student_attendance` ON `archive_student_attendance` (`student_id`, `assignment_id`, `date`, `session`);
--> statement-breakpoint

ALTER TABLE `archive_attendance_sessions` ADD COLUMN `batch_number` tinyint NOT NULL DEFAULT 0 AFTER `session`;
--> statement-breakpoint
ALTER TABLE `archive_attendance_sessions` ADD COLUMN `submitted_at` timestamp NULL AFTER `topic_covered`;
--> statement-breakpoint
ALTER TABLE `archive_attendance_sessions` ADD COLUMN `total_students` int DEFAULT 0 AFTER `submitted_at`;
--> statement-breakpoint
ALTER TABLE `archive_attendance_sessions` ADD COLUMN `present_count` int DEFAULT 0 AFTER `total_students`;
--> statement-breakpoint
ALTER TABLE `archive_attendance_sessions` ADD COLUMN `absent_count` int DEFAULT 0 AFTER `present_count`;
--> statement-breakpoint
ALTER TABLE `archive_attendance_sessions` ADD COLUMN `archive_batch_id` varchar(64) NULL AFTER `absent_count`;
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_archive_attendance_session` ON `archive_attendance_sessions` (`assignment_id`, `date`, `session`, `batch_number`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `student_streak_snapshots` (
  `student_id` int NOT NULL,
  `current_streak` int NOT NULL DEFAULT 0,
  `longest_streak` int NOT NULL DEFAULT 0,
  `previous_streak` int NOT NULL DEFAULT 0,
  `total_eligible_classes` int NOT NULL DEFAULT 0,
  `total_attended_classes` int NOT NULL DEFAULT 0,
  `total_missed_classes` int NOT NULL DEFAULT 0,
  `last_evaluated_session_id` int NULL,
  `last_evaluated_date` varchar(10) NULL,
  `last_attended_date` varchar(10) NULL,
  `last_break_date` varchar(10) NULL,
  `calculation_version` int NOT NULL DEFAULT 1,
  `policy_applied` varchar(30) NOT NULL DEFAULT 'EXCUSED_INCREMENTS',
  `is_stale` boolean NOT NULL DEFAULT false,
  `recalculated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `student_streak_snapshots_student_id` PRIMARY KEY (`student_id`),
  CONSTRAINT `fk_sss_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint

CREATE INDEX `idx_sss_stale` ON `student_streak_snapshots` (`is_stale`, `recalculated_at`);

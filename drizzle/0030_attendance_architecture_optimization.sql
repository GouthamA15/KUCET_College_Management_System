-- Migration: 0030_attendance_architecture_optimization.sql
-- Description: Optimize attendance architecture with direct session FK, strict uniqueness constraints, and session performance indexes.

ALTER TABLE `attendance_sessions`
  ADD COLUMN `total_students` int DEFAULT 0,
  ADD COLUMN `present_count` int DEFAULT 0,
  ADD COLUMN `absent_count` int DEFAULT 0,
  ADD UNIQUE INDEX `uq_assignment_session_slot` (`assignment_id`, `attendance_date`, `session_number`),
  ADD INDEX `idx_sessions_assignment_date` (`assignment_id`, `attendance_date`),
  ADD INDEX `idx_sessions_token` (`session_token`);
--> statement-breakpoint

ALTER TABLE `student_attendance`
  ADD COLUMN `session_id` int NULL;
--> statement-breakpoint

ALTER TABLE `student_attendance`
  ADD UNIQUE INDEX `uq_student_attendance` (`student_id`, `assignment_id`, `date`, `session`),
  ADD UNIQUE INDEX `uq_session_student` (`session_id`, `student_id`),
  ADD INDEX `idx_sa_student_assignment` (`student_id`, `assignment_id`),
  ADD INDEX `idx_sa_session_status` (`session_id`, `status`),
  ADD CONSTRAINT `fk_sa_session` FOREIGN KEY (`session_id`) REFERENCES `attendance_sessions` (`id`) ON DELETE CASCADE;

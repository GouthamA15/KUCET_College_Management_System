-- Migration: 0029_attendance_submission_timestamp.sql
-- Description: Add submitted_at column to student_attendance and attendance_sessions

ALTER TABLE `student_attendance` ADD COLUMN `submitted_at` timestamp;
--> statement-breakpoint
ALTER TABLE `attendance_sessions` ADD COLUMN `submitted_at` timestamp;

ALTER TABLE `attendance_sessions` DROP INDEX `attendance_sessions_session_token_unique`;--> statement-breakpoint
ALTER TABLE `attendance_sessions` DROP INDEX `idx_session_token`;--> statement-breakpoint
ALTER TABLE `clerks` DROP INDEX `clerks_email_unique`;--> statement-breakpoint
ALTER TABLE `clerks` DROP INDEX `clerks_employee_id_unique`;--> statement-breakpoint
ALTER TABLE `password_reset_tokens` DROP INDEX `password_reset_tokens_token_hash_unique`;--> statement-breakpoint
ALTER TABLE `principal` DROP INDEX `principal_email_unique`;--> statement-breakpoint
ALTER TABLE `refresh_tokens` DROP INDEX `refresh_tokens_token_hash_unique`;--> statement-breakpoint
ALTER TABLE `students` DROP INDEX `students_email_unique`;--> statement-breakpoint
ALTER TABLE `students` DROP INDEX `students_admission_no_unique`;--> statement-breakpoint
ALTER TABLE `students` DROP INDEX `students_roll_no_unique`;--> statement-breakpoint
ALTER TABLE `bug_reports` ADD `severity` enum('CRITICAL','HIGH','MEDIUM','LOW') DEFAULT 'MEDIUM' NOT NULL;--> statement-breakpoint
ALTER TABLE `bug_reports` ADD `submitted_by` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `bug_reports` ADD `user_type` enum('student','clerk','admin') NOT NULL;--> statement-breakpoint
ALTER TABLE `bug_reports` ADD `affected_page` varchar(255);--> statement-breakpoint
ALTER TABLE `bug_reports` ADD `browser_info` text;--> statement-breakpoint
CREATE INDEX `idx_session_token` ON `attendance_sessions` (`session_token`);--> statement-breakpoint
CREATE INDEX `idx_bug_severity` ON `bug_reports` (`severity`);--> statement-breakpoint
CREATE INDEX `idx_bug_submitted_by` ON `bug_reports` (`submitted_by`);
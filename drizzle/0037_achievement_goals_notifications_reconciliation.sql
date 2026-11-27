ALTER TABLE `student_streak_preferences` ADD COLUMN `reminders_enabled` boolean NOT NULL DEFAULT true;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `student_attendance_goals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`student_id` int NOT NULL,
	`goal_type` varchar(40) NOT NULL,
	`title` varchar(120) NOT NULL,
	`subject_code` varchar(30),
	`target_value` int NOT NULL,
	`baseline_value` int NOT NULL DEFAULT 0,
	`current_value` int NOT NULL DEFAULT 0,
	`semester` int,
	`academic_year` varchar(20),
	`status` varchar(20) NOT NULL DEFAULT 'ACTIVE',
	`completed_at` timestamp NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `student_attendance_goals_id` PRIMARY KEY(`id`),
	CONSTRAINT `fk_student_attendance_goals_student` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX `idx_sag_student_status` ON `student_attendance_goals` (`student_id`, `status`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `student_streak_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`student_id` int NOT NULL,
	`event_key` varchar(100) NOT NULL,
	`category` varchar(40) NOT NULL,
	`title` varchar(150) NOT NULL,
	`message` text NOT NULL,
	`emoji_char` varchar(16),
	`is_read` boolean NOT NULL DEFAULT false,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `student_streak_notifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_ssn_student_event` UNIQUE(`student_id`, `event_key`),
	CONSTRAINT `fk_student_streak_notifications_student` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX `idx_ssn_student_read` ON `student_streak_notifications` (`student_id`, `is_read`, `created_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `student_streak_reconciliation_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`student_id` int NOT NULL,
	`trigger_source` varchar(50) NOT NULL,
	`reference_id` int,
	`previous_streak` int NOT NULL DEFAULT 0,
	`new_streak` int NOT NULL DEFAULT 0,
	`previous_longest` int NOT NULL DEFAULT 0,
	`new_longest` int NOT NULL DEFAULT 0,
	`notes` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `student_streak_reconciliation_logs_id` PRIMARY KEY(`id`),
	CONSTRAINT `fk_student_streak_reconciliation_student` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX `idx_ssrl_student` ON `student_streak_reconciliation_logs` (`student_id`, `created_at`);

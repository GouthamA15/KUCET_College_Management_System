CREATE TABLE IF NOT EXISTS `attendance_streak_milestones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`milestone_code` varchar(50) NOT NULL,
	`title` varchar(100) NOT NULL,
	`description` text,
	`required_streak` int NOT NULL,
	`emoji_code` varchar(50) NOT NULL,
	`emoji_char` varchar(16) NOT NULL DEFAULT '🔥',
	`asset_url` varchar(500),
	`display_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attendance_streak_milestones_id` PRIMARY KEY(`id`),
	CONSTRAINT `attendance_streak_milestones_milestone_code_unique` UNIQUE(`milestone_code`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `student_streak_unlocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`student_id` int NOT NULL,
	`milestone_id` int NOT NULL,
	`unlocked_at` timestamp NOT NULL DEFAULT (now()),
	`verified_streak` int NOT NULL,
	`is_notified` boolean NOT NULL DEFAULT false,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `student_streak_unlocks_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_student_milestone_unlock` UNIQUE(`student_id`,`milestone_id`),
	CONSTRAINT `fk_student_streak_unlocks_student` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE cascade ON UPDATE no action,
	CONSTRAINT `fk_student_streak_unlocks_milestone` FOREIGN KEY (`milestone_id`) REFERENCES `attendance_streak_milestones`(`id`) ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `student_streak_preferences` (
	`student_id` int NOT NULL,
	`selected_emoji_char` varchar(16) NOT NULL DEFAULT '🔥',
	`selected_emoji_code` varchar(50) NOT NULL DEFAULT 'fire',
	`selected_milestone_id` int,
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `student_streak_preferences_student_id` PRIMARY KEY(`student_id`),
	CONSTRAINT `fk_student_streak_preferences_student` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_asm_required_streak` ON `attendance_streak_milestones` (`required_streak`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_asm_active_order` ON `attendance_streak_milestones` (`is_active`,`display_order`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_ssu_student` ON `student_streak_unlocks` (`student_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_ssu_milestone` ON `student_streak_unlocks` (`milestone_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_ssp_milestone` ON `student_streak_preferences` (`selected_milestone_id`);

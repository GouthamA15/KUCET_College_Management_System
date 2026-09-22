CREATE TABLE IF NOT EXISTS `student_achievements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`student_id` int NOT NULL,
	`achievement_type` varchar(50) NOT NULL,
	`title` varchar(255) NOT NULL,
	`program_name` varchar(255),
	`issuing_organization` varchar(255),
	`academic_year` varchar(9) NOT NULL,
	`achievement_date` date,
	`start_date` date,
	`end_date` date,
	`achievement_level` varchar(50),
	`recognition` varchar(100),
	`description` text,
	`certificate_file_path` varchar(500),
	`certificate_mime_type` varchar(100),
	`additional_data` json,
	`created_at` timestamp DEFAULT (now()) NOT NULL,
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `student_achievements_id` PRIMARY KEY(`id`),
	CONSTRAINT `fk_achievement_student` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `idx_achievement_student` ON `student_achievements` (`student_id`);
--> statement-breakpoint
CREATE INDEX `idx_achievement_type` ON `student_achievements` (`achievement_type`);
--> statement-breakpoint
CREATE INDEX `idx_achievement_academic_year` ON `student_achievements` (`academic_year`);
--> statement-breakpoint
CREATE INDEX `idx_achievement_date` ON `student_achievements` (`achievement_date`);
--> statement-breakpoint
CREATE INDEX `idx_achievement_student_year` ON `student_achievements` (`student_id`, `academic_year`);
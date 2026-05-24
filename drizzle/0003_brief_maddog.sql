CREATE TABLE `bug_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`description` text NOT NULL,
	`screenshot_url` text,
	`status` enum('OPEN','RESOLVED','CLOSED') NOT NULL DEFAULT 'OPEN',
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bug_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `certificate_verifications_archive` (
	`id` int NOT NULL,
	`request_id` int NOT NULL,
	`verification_date` timestamp NOT NULL,
	`ip_address` varchar(45),
	`user_agent` text,
	`device_name` varchar(255),
	`location_name` varchar(255),
	`latitude` decimal(10,8),
	`longitude` decimal(11,8),
	`archived_at` timestamp DEFAULT (now()),
	CONSTRAINT `certificate_verifications_archive_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `otp_codes` RENAME COLUMN `roll_no` TO `identifier`;--> statement-breakpoint
DROP INDEX `idx_otp_roll_no` ON `otp_codes`;--> statement-breakpoint
ALTER TABLE `student_admission_drafts` MODIFY COLUMN `annual_income` varchar(50);--> statement-breakpoint
ALTER TABLE `student_personal_details` MODIFY COLUMN `annual_income` varchar(50);--> statement-breakpoint
ALTER TABLE `clerks` ADD `mobile` varchar(255);--> statement-breakpoint
ALTER TABLE `clerks` ADD `mobile_hash` varchar(64);--> statement-breakpoint
ALTER TABLE `clerks` ADD `pfp` text;--> statement-breakpoint
ALTER TABLE `clerks` ADD `signature` text;--> statement-breakpoint
ALTER TABLE `clerks` ADD `address` text;--> statement-breakpoint
CREATE INDEX `idx_bug_status` ON `bug_reports` (`status`);--> statement-breakpoint
CREATE INDEX `idx_bug_created_at` ON `bug_reports` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_cv_archive_request` ON `certificate_verifications_archive` (`request_id`);--> statement-breakpoint
CREATE INDEX `idx_cv_archive_date` ON `certificate_verifications_archive` (`verification_date`);--> statement-breakpoint
CREATE INDEX `idx_otp_identifier` ON `otp_codes` (`identifier`);
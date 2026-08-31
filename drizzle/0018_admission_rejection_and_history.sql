-- Migration 0018: Add soft rejection and status history for admission drafts
ALTER TABLE `student_admission_drafts` MODIFY COLUMN `status` enum('DRAFT','PROCESSED','FINALIZED','REJECTED') NOT NULL DEFAULT 'DRAFT';
--> statement-breakpoint
ALTER TABLE `student_admission_drafts` ADD COLUMN `rejection_reason` text NULL;
--> statement-breakpoint
ALTER TABLE `student_admission_drafts` ADD COLUMN `rejected_by_staff_id` int NULL;
--> statement-breakpoint
ALTER TABLE `student_admission_drafts` ADD COLUMN `rejected_at` timestamp NULL;
--> statement-breakpoint
ALTER TABLE `student_admission_drafts` ADD COLUMN `restored_by_staff_id` int NULL;
--> statement-breakpoint
ALTER TABLE `student_admission_drafts` ADD COLUMN `restored_at` timestamp NULL;
--> statement-breakpoint
ALTER TABLE `student_admission_drafts` ADD COLUMN `restoration_reason` text NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `admission_status_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`draft_id` int NOT NULL,
	`old_status` varchar(50),
	`new_status` varchar(50) NOT NULL,
	`reason` text,
	`changed_by_user_id` int,
	`changed_by_user_type` varchar(50) DEFAULT 'staff',
	`metadata` json,
	`created_at` timestamp DEFAULT (now()) NOT NULL,
	CONSTRAINT `admission_status_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_ash_draft_id` ON `admission_status_history` (`draft_id`);
--> statement-breakpoint
CREATE INDEX `idx_ash_created_at` ON `admission_status_history` (`created_at`);

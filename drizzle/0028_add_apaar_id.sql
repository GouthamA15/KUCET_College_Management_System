-- Migration: 0028_add_apaar_id.sql
-- Description: Add apaar_id column and index to student_personal_details and student_admission_drafts

ALTER TABLE `student_personal_details` ADD COLUMN `apaar_id` varchar(20);
--> statement-breakpoint
CREATE INDEX `idx_spd_apaar_id` ON `student_personal_details` (`apaar_id`);
--> statement-breakpoint
ALTER TABLE `student_admission_drafts` ADD COLUMN `apaar_id` varchar(20);
--> statement-breakpoint
CREATE INDEX `idx_draft_apaar_id` ON `student_admission_drafts` (`apaar_id`);

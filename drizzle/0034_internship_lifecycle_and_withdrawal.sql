ALTER TABLE `student_internships` MODIFY COLUMN `application_status` enum('DRAFT','SUBMITTED','UNDER_REVIEW','ADDITIONAL_INFO_REQUIRED','APPROVED','REJECTED','WITHDRAWAL_REQUESTED','WITHDRAWN') NOT NULL DEFAULT 'SUBMITTED';
--> statement-breakpoint
ALTER TABLE `student_internships` ADD COLUMN `stage` enum('UPCOMING','ONGOING','COMPLETED') NOT NULL DEFAULT 'UPCOMING';
--> statement-breakpoint
ALTER TABLE `student_internships` ADD COLUMN `is_unverified_company_exception` boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE `student_internships` ADD COLUMN `unverified_company_exception_reason` text;
--> statement-breakpoint
ALTER TABLE `student_internships` ADD COLUMN `unverified_company_exception_by` int;
--> statement-breakpoint
ALTER TABLE `student_internships` ADD COLUMN `unverified_company_exception_at` timestamp;
--> statement-breakpoint
ALTER TABLE `student_internships` ADD COLUMN `has_overlap_warning` boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE `student_internships` ADD COLUMN `overlap_details` text;
--> statement-breakpoint
ALTER TABLE `student_internships` ADD COLUMN `withdrawal_reason` text;
--> statement-breakpoint
ALTER TABLE `student_internships` ADD COLUMN `withdrawal_requested_at` timestamp;
--> statement-breakpoint
ALTER TABLE `student_internships` ADD COLUMN `withdrawal_reviewed_by` int;
--> statement-breakpoint
ALTER TABLE `student_internships` ADD COLUMN `withdrawal_reviewed_at` timestamp;
--> statement-breakpoint
ALTER TABLE `student_internships` ADD COLUMN `withdrawal_remarks` text;
--> statement-breakpoint
ALTER TABLE `student_internships` ADD CONSTRAINT `fk_si_unverified_exc_by` FOREIGN KEY (`unverified_company_exception_by`) REFERENCES `staff_accounts`(`id`) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE `student_internships` ADD CONSTRAINT `fk_si_withdrawal_reviewed_by` FOREIGN KEY (`withdrawal_reviewed_by`) REFERENCES `staff_accounts`(`id`) ON DELETE SET NULL;

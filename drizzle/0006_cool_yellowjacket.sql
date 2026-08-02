ALTER TABLE `otp_codes` MODIFY COLUMN `otp_code` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `students` MODIFY COLUMN `fee_reimbursement` enum('YES','NO','GOV') NOT NULL DEFAULT 'NO';
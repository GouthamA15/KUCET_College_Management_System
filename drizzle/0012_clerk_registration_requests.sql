ALTER TABLE `clerks` ADD COLUMN `must_change_password` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE `clerk_registration_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`employee_id` varchar(255) NOT NULL,
	`staff_category` varchar(50) NOT NULL DEFAULT 'FACULTY',
	`branch` varchar(50),
	`department` varchar(100),
	`designation` varchar(100),
	`mobile` varchar(255),
	`mobile_hash` varchar(64),
	`pfp` text,
	`signature` text,
	`status` enum('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
	`rejection_reason` text,
	`processed_at` timestamp,
	`processed_by_admin_id` int,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clerk_registration_requests_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE INDEX `idx_clerk_req_email` ON `clerk_registration_requests` (`email`);--> statement-breakpoint
CREATE INDEX `idx_clerk_req_employee_id` ON `clerk_registration_requests` (`employee_id`);--> statement-breakpoint
CREATE INDEX `idx_clerk_req_status` ON `clerk_registration_requests` (`status`);--> statement-breakpoint
CREATE INDEX `idx_clerk_req_category` ON `clerk_registration_requests` (`staff_category`);


ALTER TABLE `clerks` ADD COLUMN `must_change_password` boolean DEFAULT false NOT NULL;

CREATE TABLE `clerk_registration_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`employee_id` varchar(255) NOT NULL,
	`department` varchar(100) NOT NULL,
	`designation` varchar(100) NOT NULL,
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
);

CREATE INDEX `idx_clerk_req_email` ON `clerk_registration_requests` (`email`);
CREATE INDEX `idx_clerk_req_employee_id` ON `clerk_registration_requests` (`employee_id`);
CREATE INDEX `idx_clerk_req_status` ON `clerk_registration_requests` (`status`);

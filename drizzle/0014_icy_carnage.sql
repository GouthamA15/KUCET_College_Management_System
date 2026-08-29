CREATE TABLE `academic_departments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`department_code` varchar(50) NOT NULL,
	`department_name` varchar(255) NOT NULL,
	`is_active` boolean DEFAULT true,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `academic_departments_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_academic_departments_code` UNIQUE(`department_code`)
);
--> statement-breakpoint
CREATE TABLE `academic_programs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`department_id` int NOT NULL,
	`program_code` varchar(50) NOT NULL,
	`program_name` varchar(255) NOT NULL,
	`is_active` boolean DEFAULT true,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `academic_programs_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_academic_programs_code` UNIQUE(`program_code`)
);
--> statement-breakpoint
CREATE TABLE `faculty_hod_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staff_account_id` int NOT NULL,
	`department_id` int NOT NULL,
	`academic_year` varchar(50) NOT NULL,
	`start_date` date NOT NULL,
	`end_date` date,
	`is_active` boolean DEFAULT true,
	`assigned_by` int,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `faculty_hod_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staff_academic_affiliations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staff_account_id` int NOT NULL,
	`department_id` int NOT NULL,
	`program_id` int,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `staff_academic_affiliations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staff_account_activation_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staff_account_id` int NOT NULL,
	`token_hash` varchar(255) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`used_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `staff_account_activation_tokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staff_account_roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staff_account_id` int NOT NULL,
	`role_id` int NOT NULL,
	`assigned_at` timestamp DEFAULT (now()),
	`assigned_by` int,
	CONSTRAINT `staff_account_roles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staff_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`employee_id` varchar(255) NOT NULL,
	`password_hash` varchar(255),
	`staff_category` enum('FACULTY','NON_TEACHING') NOT NULL,
	`designation` varchar(100),
	`mobile_hash` varchar(64),
	`pfp` text,
	`signature` text,
	`address` text,
	`account_status` enum('PENDING_ACTIVATION','ACTIVE','SUSPENDED','DISABLED') NOT NULL DEFAULT 'PENDING_ACTIVATION',
	`must_change_password` boolean NOT NULL DEFAULT false,
	`last_login_at` timestamp,
	`last_login_ip` varchar(45),
	`password_changed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staff_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_staff_email` UNIQUE(`email`),
	CONSTRAINT `uq_staff_employee_id` UNIQUE(`employee_id`)
);
--> statement-breakpoint
CREATE TABLE `staff_registration_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`employee_id` varchar(255),
	`staff_category` enum('FACULTY','NON_TEACHING') NOT NULL,
	`academic_affiliations` json,
	`requested_role` varchar(50) NOT NULL,
	`branch` varchar(50),
	`designation` varchar(100),
	`mobile_hash` varchar(64),
	`pfp` text,
	`signature` text,
	`status` enum('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
	`rejection_reason` text,
	`processed_at` timestamp,
	`processed_by_admin_id` int,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	`email_verified_at` timestamp,
	CONSTRAINT `staff_registration_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staff_roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`role_code` varchar(50) NOT NULL,
	`description` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `staff_roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_staff_roles_code` UNIQUE(`role_code`)
);
--> statement-breakpoint
CREATE INDEX `idx_academic_programs_dept` ON `academic_programs` (`department_id`);--> statement-breakpoint
CREATE INDEX `idx_faculty_hod_staff` ON `faculty_hod_assignments` (`staff_account_id`);--> statement-breakpoint
CREATE INDEX `idx_faculty_hod_dept` ON `faculty_hod_assignments` (`department_id`);--> statement-breakpoint
CREATE INDEX `idx_staff_acad_affil_staff` ON `staff_academic_affiliations` (`staff_account_id`);--> statement-breakpoint
CREATE INDEX `idx_staff_activation_hash` ON `staff_account_activation_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_staff_activation_staff` ON `staff_account_activation_tokens` (`staff_account_id`);--> statement-breakpoint
CREATE INDEX `idx_staff_account_roles_staff` ON `staff_account_roles` (`staff_account_id`);--> statement-breakpoint
CREATE INDEX `idx_staff_account_roles_role` ON `staff_account_roles` (`role_id`);--> statement-breakpoint
CREATE INDEX `idx_staff_account_status` ON `staff_accounts` (`account_status`);--> statement-breakpoint
CREATE INDEX `idx_staff_req_email` ON `staff_registration_requests` (`email`);--> statement-breakpoint
CREATE INDEX `idx_staff_req_employee_id` ON `staff_registration_requests` (`employee_id`);--> statement-breakpoint
CREATE INDEX `idx_staff_req_status` ON `staff_registration_requests` (`status`);
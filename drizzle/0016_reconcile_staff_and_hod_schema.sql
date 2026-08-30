CREATE TABLE IF NOT EXISTS `academic_departments` (
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
CREATE TABLE IF NOT EXISTS `academic_programs` (
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
CREATE TABLE IF NOT EXISTS `staff_roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`role_code` varchar(50) NOT NULL,
	`description` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `staff_roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_staff_roles_code` UNIQUE(`role_code`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `staff_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`employee_id` varchar(255) NOT NULL,
	`password_hash` varchar(255),
	`staff_category` varchar(50) NOT NULL,
	`designation` varchar(100) NOT NULL,
	`mobile_hash` varchar(255),
	`pfp` text,
	`signature` text,
	`address` text,
	`account_status` enum('PENDING_ACTIVATION','ACTIVE','SUSPENDED','DISABLED') NOT NULL DEFAULT 'PENDING_ACTIVATION',
	`last_login_at` timestamp,
	`last_login_ip` varchar(64),
	`password_changed_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staff_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_staff_email` UNIQUE(`email`),
	CONSTRAINT `uq_staff_employee_id` UNIQUE(`employee_id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `staff_account_roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staff_account_id` int NOT NULL,
	`role_id` int NOT NULL,
	`assigned_at` timestamp DEFAULT (now()),
	`assigned_by` int,
	CONSTRAINT `staff_account_roles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `staff_academic_affiliations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staff_account_id` int NOT NULL,
	`department_id` int NOT NULL,
	`program_id` int,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `staff_academic_affiliations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `staff_account_activation_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staff_account_id` int NOT NULL,
	`token_hash` varchar(255) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`used_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `staff_account_activation_tokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `staff_registration_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`employee_id` varchar(255),
	`staff_category` varchar(50),
	`academic_affiliations` json,
	`requested_role` varchar(50),
	`branch` varchar(50),
	`designation` varchar(100),
	`address` text,
	`mobile_hash` varchar(255),
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
CREATE TABLE IF NOT EXISTS `faculty_hod_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staff_account_id` int NOT NULL,
	`department_code` varchar(20) NOT NULL,
	`academic_year` varchar(9) NOT NULL,
	`start_date` date NOT NULL,
	`end_date` date,
	`is_active` boolean DEFAULT true NOT NULL,
	`assigned_by` int,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `faculty_hod_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `faculty_hod_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staff_account_id` int NOT NULL,
	`department_code` varchar(20) NOT NULL,
	`academic_year` varchar(9) NOT NULL,
	`status` enum('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
	`reviewed_by` int,
	`reviewed_at` timestamp,
	`rejection_reason` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `faculty_hod_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
INSERT IGNORE INTO `staff_roles` (`role_code`, `description`) VALUES 
('FACULTY', 'Teaching Faculty'),
('HOD', 'Head of Department'),
('ADMISSION_STAFF', 'Admission Processing Clerk'),
('SCHOLARSHIP_STAFF', 'Scholarship Processing Clerk');
--> statement-breakpoint
INSERT IGNORE INTO `academic_departments` (`department_code`, `department_name`, `is_active`) VALUES 
('CSE', 'Computer Science and Engineering', true),
('CSD', 'Computer Science and Engineering (Data Science)', true),
('ECE', 'Electronics and Communication Engineering', true),
('EEE', 'Electrical and Electronics Engineering', true),
('CIVIL', 'Civil Engineering', true),
('IT', 'Information Technology', true),
('MECH', 'Mechanical Engineering', true);

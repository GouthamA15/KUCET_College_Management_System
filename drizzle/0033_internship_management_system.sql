-- Migration: 0033_internship_management_system.sql
-- Description: Complete schema for KUCET Internship Management System including companies, opportunities, student internships, documents, and audit logs.

CREATE TABLE IF NOT EXISTS `internship_companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`company_name` varchar(255) NOT NULL,
	`normalized_name` varchar(255) NOT NULL,
	`website` varchar(255),
	`industry` varchar(100),
	`address` text,
	`location` varchar(150),
	`contact_person` varchar(150),
	`contact_email` varchar(150),
	`contact_phone` varchar(50),
	`verification_status` enum('PENDING_VERIFICATION','VERIFIED','REJECTED','INACTIVE') NOT NULL DEFAULT 'PENDING_VERIFICATION',
	`verified_by` int,
	`verified_at` timestamp,
	`rejection_reason` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by_user_type` enum('STAFF','STUDENT','ADMIN') NOT NULL DEFAULT 'STAFF',
	`created_by_id` int,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `internship_companies_id` PRIMARY KEY(`id`),
	CONSTRAINT `fk_ic_verified_by` FOREIGN KEY (`verified_by`) REFERENCES `staff_accounts`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ic_norm_name` ON `internship_companies` (`normalized_name`);
--> statement-breakpoint
CREATE INDEX `idx_ic_status` ON `internship_companies` (`verification_status`,`is_active`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `internship_opportunities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`company_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`category` varchar(100) NOT NULL DEFAULT 'General Engineering',
	`required_skills` text,
	`required_qualifications` text,
	`eligible_branches` json NOT NULL,
	`eligible_academic_years` json NOT NULL,
	`min_cgpa` decimal(4,2),
	`start_date` date,
	`end_date` date,
	`duration` varchar(50),
	`mode` enum('ONLINE','OFFLINE','HYBRID') NOT NULL DEFAULT 'HYBRID',
	`location` varchar(150),
	`stipend` varchar(100),
	`openings_count` int NOT NULL DEFAULT 1,
	`opening_date` date,
	`deadline` date NOT NULL,
	`additional_requirements` text,
	`status` enum('DRAFT','PUBLISHED','UNPUBLISHED','CLOSED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
	`published_at` timestamp,
	`created_by_staff_id` int,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `internship_opportunities_id` PRIMARY KEY(`id`),
	CONSTRAINT `fk_io_company` FOREIGN KEY (`company_id`) REFERENCES `internship_companies`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_io_created_by` FOREIGN KEY (`created_by_staff_id`) REFERENCES `staff_accounts`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX `idx_io_company` ON `internship_opportunities` (`company_id`);
--> statement-breakpoint
CREATE INDEX `idx_io_status_deadline` ON `internship_opportunities` (`status`,`deadline`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `student_internships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`student_id` int NOT NULL,
	`registration_type` enum('INTERNAL_APPLICATION','EXTERNAL_SELF_IDENTIFIED') NOT NULL,
	`opportunity_id` int,
	`company_id` int,
	`company_name` varchar(255) NOT NULL,
	`company_website` varchar(255),
	`company_location` varchar(150),
	`role_title` varchar(255) NOT NULL,
	`description` text,
	`mode` enum('ONLINE','OFFLINE','HYBRID') NOT NULL DEFAULT 'HYBRID',
	`start_date` date NOT NULL,
	`end_date` date NOT NULL,
	`duration` varchar(50),
	`stipend` varchar(100),
	`supervisor_name` varchar(150),
	`supervisor_email` varchar(150),
	`supervisor_phone` varchar(50),
	`skills_acquired` text,
	`statement_of_interest` text,
	`application_status` enum('DRAFT','SUBMITTED','UNDER_REVIEW','ADDITIONAL_INFO_REQUIRED','APPROVED','REJECTED','WITHDRAWN') NOT NULL DEFAULT 'SUBMITTED',
	`internship_status` enum('NOT_STARTED','ONGOING','COMPLETED','TERMINATED') NOT NULL DEFAULT 'NOT_STARTED',
	`reviewed_by_staff_id` int,
	`reviewed_at` timestamp,
	`rejection_reason` text,
	`coordinator_remarks` text,
	`additional_info_instructions` text,
	`completion_status` enum('NOT_SUBMITTED','SUBMITTED_FOR_VERIFICATION','VERIFIED_COMPLETED','VERIFICATION_REJECTED','ADDITIONAL_DOCS_REQUESTED') NOT NULL DEFAULT 'NOT_SUBMITTED',
	`actual_completion_date` date,
	`student_completion_remarks` text,
	`verified_by_staff_id` int,
	`verified_at` timestamp,
	`verification_remarks` text,
	`credits_eligible` int NOT NULL DEFAULT 0,
	`credits_awarded` int NOT NULL DEFAULT 0,
	`credits_approved_by` int,
	`credits_approved_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `student_internships_id` PRIMARY KEY(`id`),
	CONSTRAINT `fk_si_student` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_si_opportunity` FOREIGN KEY (`opportunity_id`) REFERENCES `internship_opportunities`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_si_company` FOREIGN KEY (`company_id`) REFERENCES `internship_companies`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_si_reviewed_by` FOREIGN KEY (`reviewed_by_staff_id`) REFERENCES `staff_accounts`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_si_verified_by` FOREIGN KEY (`verified_by_staff_id`) REFERENCES `staff_accounts`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_si_credits_approved_by` FOREIGN KEY (`credits_approved_by`) REFERENCES `staff_accounts`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX `idx_si_student` ON `student_internships` (`student_id`);
--> statement-breakpoint
CREATE INDEX `idx_si_opportunity` ON `student_internships` (`opportunity_id`);
--> statement-breakpoint
CREATE INDEX `idx_si_company` ON `student_internships` (`company_id`);
--> statement-breakpoint
CREATE INDEX `idx_si_app_status` ON `student_internships` (`application_status`);
--> statement-breakpoint
CREATE INDEX `idx_si_lifecycle_status` ON `student_internships` (`internship_status`);
--> statement-breakpoint
CREATE INDEX `idx_si_completion_status` ON `student_internships` (`completion_status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_student_internal_opp` ON `student_internships` (`student_id`, `opportunity_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `internship_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`internship_id` int NOT NULL,
	`student_id` int NOT NULL,
	`document_type` enum('OFFER_LETTER','JOINING_LETTER','COMPLETION_CERTIFICATE','INTERNSHIP_REPORT','RECOMMENDATION_LETTER','OTHER_SUPPORTING_DOCUMENT') NOT NULL,
	`original_filename` varchar(255) NOT NULL,
	`storage_key` varchar(500) NOT NULL,
	`mime_type` varchar(100) NOT NULL DEFAULT 'application/pdf',
	`file_size_bytes` int NOT NULL DEFAULT 0,
	`verification_status` enum('PENDING','VERIFIED','REJECTED','SUPERSEDED') NOT NULL DEFAULT 'PENDING',
	`verified_by_staff_id` int,
	`verified_at` timestamp,
	`rejection_reason` text,
	`version` int NOT NULL DEFAULT 1,
	`uploaded_by_user_type` enum('STUDENT','STAFF','ADMIN') NOT NULL DEFAULT 'STUDENT',
	`uploaded_by_id` int,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `internship_documents_id` PRIMARY KEY(`id`),
	CONSTRAINT `fk_idoc_internship` FOREIGN KEY (`internship_id`) REFERENCES `student_internships`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_idoc_student` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_idoc_verified_by` FOREIGN KEY (`verified_by_staff_id`) REFERENCES `staff_accounts`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX `idx_idoc_internship` ON `internship_documents` (`internship_id`);
--> statement-breakpoint
CREATE INDEX `idx_idoc_student` ON `internship_documents` (`student_id`);
--> statement-breakpoint
CREATE INDEX `idx_idoc_type` ON `internship_documents` (`document_type`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `internship_audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`internship_id` int,
	`opportunity_id` int,
	`company_id` int,
	`actor_type` enum('STUDENT','STAFF','ADMIN','SYSTEM') NOT NULL,
	`actor_id` int NOT NULL,
	`action` varchar(100) NOT NULL,
	`details` json,
	`ip_address` varchar(64),
	`user_agent` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `internship_audit_logs_id` PRIMARY KEY(`id`),
	CONSTRAINT `fk_iaudit_internship` FOREIGN KEY (`internship_id`) REFERENCES `student_internships`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_iaudit_opportunity` FOREIGN KEY (`opportunity_id`) REFERENCES `internship_opportunities`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_iaudit_company` FOREIGN KEY (`company_id`) REFERENCES `internship_companies`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX `idx_iaudit_internship` ON `internship_audit_logs` (`internship_id`);
--> statement-breakpoint
CREATE INDEX `idx_iaudit_action` ON `internship_audit_logs` (`action`);
--> statement-breakpoint
CREATE INDEX `idx_iaudit_actor` ON `internship_audit_logs` (`actor_type`, `actor_id`);
--> statement-breakpoint
INSERT INTO `staff_roles` (`role_code`, `role_name`, `description`) 
VALUES ('INTERNSHIP_COORDINATOR', 'Internship Coordinator', 'College-wide Internship Coordinator with oversight across all branches and academic years')
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`), `role_name` = VALUES(`role_name`);

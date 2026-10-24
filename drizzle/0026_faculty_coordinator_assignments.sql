-- Migration: 0026_faculty_coordinator_assignments.sql
-- Description: Create faculty_coordinator_assignments table for time-bounded academic coordinator sub-roles (e.g. First Year Coordinator)

CREATE TABLE IF NOT EXISTS `faculty_coordinator_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staff_account_id` int NOT NULL,
	`coordinator_type` varchar(50) NOT NULL DEFAULT 'FIRST_YEAR',
	`academic_year` varchar(9) NOT NULL,
	`start_date` date NOT NULL,
	`end_date` date,
	`is_active` boolean NOT NULL DEFAULT true,
	`assigned_by` int,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `faculty_coordinator_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_coord_staff_id` ON `faculty_coordinator_assignments` (`staff_account_id`);
--> statement-breakpoint
CREATE INDEX `idx_coord_type_active` ON `faculty_coordinator_assignments` (`coordinator_type`,`is_active`);
--> statement-breakpoint
CREATE INDEX `idx_coord_acad_year` ON `faculty_coordinator_assignments` (`academic_year`);

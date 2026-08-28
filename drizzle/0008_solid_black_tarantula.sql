CREATE TABLE `archive_attendance_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`original_session_id` int,
	`assignment_id` int NOT NULL,
	`branch` varchar(50) NOT NULL,
	`semester` tinyint NOT NULL,
	`academic_year` varchar(9) NOT NULL,
	`date` date NOT NULL,
	`session` tinyint NOT NULL,
	`faculty_id` int,
	`topic_covered` text,
	`created_at` timestamp,
	`archived_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `archive_attendance_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `archive_operations_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`job_id` varchar(64) NOT NULL,
	`archive_type` enum('SEMESTER','ALUMNI','MEDIA','RESTORE','MANUAL') NOT NULL,
	`branch` varchar(50),
	`semester` tinyint,
	`academic_year` varchar(9),
	`affected_students_count` int NOT NULL DEFAULT 0,
	`affected_records_count` int NOT NULL DEFAULT 0,
	`affected_media_count` int NOT NULL DEFAULT 0,
	`storage_size_bytes` int NOT NULL DEFAULT 0,
	`archived_by` varchar(100) NOT NULL,
	`execution_time_ms` int NOT NULL DEFAULT 0,
	`status` enum('PENDING','RUNNING','COMPLETED','FAILED','RESTORED') NOT NULL DEFAULT 'COMPLETED',
	`error_message` text,
	`details` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `archive_operations_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `archive_retention_policies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entity_type` enum('ATTENDANCE','MARKS','PAYMENT_EVIDENCE','GRADUATED_STUDENTS','SIGNATURES') NOT NULL,
	`auto_archive_enabled` boolean NOT NULL DEFAULT true,
	`retention_months` int NOT NULL DEFAULT 6,
	`description` text,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`updated_by` varchar(100) DEFAULT 'SYSTEM',
	CONSTRAINT `archive_retention_policies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `archive_student_academic_background` (
	`id` int AUTO_INCREMENT NOT NULL,
	`archive_student_id` int NOT NULL,
	`ssc_school` text,
	`ssc_gpa` varchar(10),
	`inter_college` text,
	`inter_gpa` varchar(10),
	`archived_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `archive_student_academic_background_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `archive_student_attendance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`original_attendance_id` int,
	`student_id` int NOT NULL,
	`roll_no` varchar(20) NOT NULL,
	`assignment_id` int NOT NULL,
	`branch` varchar(50) NOT NULL,
	`semester` tinyint NOT NULL,
	`subject_code` varchar(50),
	`academic_year` varchar(9) NOT NULL,
	`date` date NOT NULL,
	`session` tinyint NOT NULL,
	`status` enum('PRESENT','ABSENT','EXEMPTED') NOT NULL DEFAULT 'PRESENT',
	`marked_by` int,
	`verification_mode` varchar(20) DEFAULT 'MANUAL',
	`device_fingerprint` text,
	`created_at` timestamp,
	`archived_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `archive_student_attendance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `archive_student_marks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`original_mark_id` int,
	`student_id` int NOT NULL,
	`roll_no` varchar(20) NOT NULL,
	`assignment_id` int NOT NULL,
	`subject_code` varchar(50),
	`branch` varchar(50),
	`semester` tinyint,
	`academic_year` varchar(9),
	`mid1_marks` decimal(5,2),
	`mid2_marks` decimal(5,2),
	`assignment_marks` decimal(5,2),
	`lab_theory_marks` decimal(5,2),
	`lab_execution_marks` decimal(5,2),
	`lab_record_marks` decimal(5,2),
	`is_published` boolean DEFAULT true,
	`created_at` timestamp,
	`archived_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `archive_student_marks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `archive_student_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`original_payment_id` int,
	`student_id` int NOT NULL,
	`roll_no` varchar(20) NOT NULL,
	`academic_year` varchar(9) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`transaction_ref_no` varchar(100),
	`transaction_date` date,
	`payment_mode` varchar(50),
	`bank_name` varchar(100),
	`proof_url` text,
	`status` varchar(50) DEFAULT 'VERIFIED',
	`created_at` timestamp,
	`archived_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `archive_student_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `archive_student_personal_details` (
	`id` int AUTO_INCREMENT NOT NULL,
	`archive_student_id` int NOT NULL,
	`original_detail_id` int,
	`father_name` varchar(255),
	`mother_name` varchar(255),
	`dob` date,
	`category` varchar(50),
	`sub_caste` varchar(50),
	`gender` varchar(20),
	`aadhaar_no` varchar(512),
	`guardian_mobile` varchar(512),
	`permanent_address` text,
	`signature_path` text,
	`archived_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `archive_student_personal_details_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `archive_students` (
	`id` int AUTO_INCREMENT NOT NULL,
	`original_student_id` int NOT NULL,
	`roll_no` varchar(20) NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255),
	`mobile` varchar(512),
	`branch` varchar(50),
	`batch` varchar(20),
	`admission_year` varchar(9),
	`graduation_year` varchar(9),
	`academic_status` varchar(50) DEFAULT 'GRADUATED',
	`student_status` varchar(50) DEFAULT 'ARCHIVED',
	`fee_reimbursement` varchar(10),
	`pfp` text,
	`archived_at` timestamp NOT NULL DEFAULT (now()),
	`archived_by` varchar(100) DEFAULT 'SYSTEM',
	`archive_reason` text,
	CONSTRAINT `archive_students_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_archive_sessions_assignment_date` ON `archive_attendance_sessions` (`assignment_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_archive_sessions_lookup` ON `archive_attendance_sessions` (`branch`,`semester`,`academic_year`);--> statement-breakpoint
CREATE INDEX `idx_archive_log_job_id` ON `archive_operations_log` (`job_id`);--> statement-breakpoint
CREATE INDEX `idx_archive_log_type` ON `archive_operations_log` (`archive_type`);--> statement-breakpoint
CREATE INDEX `idx_archive_log_created` ON `archive_operations_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_archive_background_student_id` ON `archive_student_academic_background` (`archive_student_id`);--> statement-breakpoint
CREATE INDEX `idx_archive_att_roll` ON `archive_student_attendance` (`roll_no`);--> statement-breakpoint
CREATE INDEX `idx_archive_att_branch_sem_year` ON `archive_student_attendance` (`branch`,`semester`,`academic_year`);--> statement-breakpoint
CREATE INDEX `idx_archive_att_date` ON `archive_student_attendance` (`date`);--> statement-breakpoint
CREATE INDEX `idx_archive_marks_roll` ON `archive_student_marks` (`roll_no`);--> statement-breakpoint
CREATE INDEX `idx_archive_marks_assignment` ON `archive_student_marks` (`assignment_id`);--> statement-breakpoint
CREATE INDEX `idx_archive_payments_roll` ON `archive_student_payments` (`roll_no`);--> statement-breakpoint
CREATE INDEX `idx_archive_payments_ref` ON `archive_student_payments` (`transaction_ref_no`);--> statement-breakpoint
CREATE INDEX `idx_archive_personal_student_id` ON `archive_student_personal_details` (`archive_student_id`);--> statement-breakpoint
CREATE INDEX `idx_archive_students_roll_no` ON `archive_students` (`roll_no`);--> statement-breakpoint
CREATE INDEX `idx_archive_students_branch_batch` ON `archive_students` (`branch`,`batch`);
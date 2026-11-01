-- Migration: 0022_academic_calendar_attendance_disputes_and_workflows.sql
-- Description: Add makeup class exceptions, student attendance disputes, attendance audit logs,
--              student inactivity tracking, student reactivation requests, and HOD certificate approval fields.

-- 1. Makeup Class Exceptions
CREATE TABLE IF NOT EXISTS `makeup_class_exceptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assignment_id` int NOT NULL,
	`exception_date` date NOT NULL,
	`session_number` int,
	`reason` text NOT NULL,
	`authorized_by_staff_id` int NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `makeup_class_exceptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_mce_assignment_date` ON `makeup_class_exceptions` (`assignment_id`, `exception_date`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_makeup_class_exception` ON `makeup_class_exceptions` (`assignment_id`, `exception_date`, `session_number`);
--> statement-breakpoint

-- 2. Student Attendance Disputes
CREATE TABLE IF NOT EXISTS `student_attendance_disputes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`student_id` int NOT NULL,
	`assignment_id` int NOT NULL,
	`attendance_date` date NOT NULL,
	`session` int NOT NULL,
	`original_status` enum('ABSENT') DEFAULT 'ABSENT' NOT NULL,
	`requested_status` enum('PRESENT', 'NCC', 'MEDICAL') DEFAULT 'PRESENT' NOT NULL,
	`category` varchar(50) DEFAULT 'INCORRECT_MARKING' NOT NULL,
	`reason` text NOT NULL,
	`additional_explanation` text,
	`student_declaration` boolean DEFAULT true NOT NULL,
	`proof_url` varchar(500),
	`status` enum('PENDING', 'APPROVED', 'REJECTED', 'MORE_INFO_REQUIRED') DEFAULT 'PENDING' NOT NULL,
	`reviewed_by_staff_id` int,
	`reviewed_at` timestamp,
	`rejection_reason` text,
	`reviewer_comments` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `student_attendance_disputes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_sad_student` ON `student_attendance_disputes` (`student_id`);
--> statement-breakpoint
CREATE INDEX `idx_sad_assignment_date` ON `student_attendance_disputes` (`assignment_id`, `attendance_date`);
--> statement-breakpoint
CREATE INDEX `idx_sad_status` ON `student_attendance_disputes` (`status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_student_dispute_session` ON `student_attendance_disputes` (`student_id`, `assignment_id`, `attendance_date`, `session`);
--> statement-breakpoint

-- 2b. Attendance Dispute Supporting Attachments
CREATE TABLE IF NOT EXISTS `attendance_dispute_attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dispute_id` int NOT NULL,
	`student_id` int NOT NULL,
	`file_key` varchar(500) NOT NULL,
	`file_name` varchar(255) NOT NULL,
	`file_size` int NOT NULL,
	`mime_type` varchar(100) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `attendance_dispute_attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_ada_dispute` ON `attendance_dispute_attachments` (`dispute_id`);
--> statement-breakpoint
CREATE INDEX `idx_ada_student` ON `attendance_dispute_attachments` (`student_id`);
--> statement-breakpoint

-- 3. Attendance Audit Logs
CREATE TABLE IF NOT EXISTS `attendance_audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`student_id` int NOT NULL,
	`assignment_id` int NOT NULL,
	`attendance_date` date NOT NULL,
	`session` int NOT NULL,
	`previous_status` varchar(20),
	`new_status` varchar(20) NOT NULL,
	`modified_by_staff_id` int NOT NULL,
	`change_type` varchar(50) DEFAULT 'MANUAL_CORRECTION' NOT NULL,
	`dispute_id` int,
	`reason` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `attendance_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_aal_student_date` ON `attendance_audit_logs` (`student_id`, `attendance_date`);
--> statement-breakpoint
CREATE INDEX `idx_aal_assignment` ON `attendance_audit_logs` (`assignment_id`);
--> statement-breakpoint
CREATE INDEX `idx_aal_dispute` ON `attendance_audit_logs` (`dispute_id`);
--> statement-breakpoint

-- 4. Student Inactivity Logs
CREATE TABLE IF NOT EXISTS `student_inactivity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`student_id` int NOT NULL,
	`academic_year` varchar(9) NOT NULL,
	`last_attendance_date` date,
	`inactivity_days` int NOT NULL,
	`action_taken` enum('WARNING_SENT', 'DEACTIVATED', 'REACTIVATED') NOT NULL,
	`authorized_by_id` int,
	`remarks` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `student_inactivity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_sil_student` ON `student_inactivity_logs` (`student_id`);
--> statement-breakpoint
CREATE INDEX `idx_sil_action` ON `student_inactivity_logs` (`action_taken`);
--> statement-breakpoint

-- 5. Student Reactivation Requests
CREATE TABLE IF NOT EXISTS `student_reactivation_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`student_id` int NOT NULL,
	`reason` text NOT NULL,
	`status` enum('PENDING_HOD', 'PENDING_ADMIN', 'APPROVED', 'REJECTED') DEFAULT 'PENDING_HOD' NOT NULL,
	`hod_reviewer_id` int,
	`hod_reviewed_at` timestamp,
	`hod_decision` enum('APPROVED', 'REJECTED'),
	`hod_remarks` text,
	`admin_reviewer_id` int,
	`admin_reviewed_at` timestamp,
	`admin_decision` enum('APPROVED', 'REJECTED'),
	`admin_remarks` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `student_reactivation_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_srr_student` ON `student_reactivation_requests` (`student_id`);
--> statement-breakpoint
CREATE INDEX `idx_srr_status` ON `student_reactivation_requests` (`status`);
--> statement-breakpoint

-- 6. Alter students.student_status enum to add INACTIVE_ATTENDANCE
ALTER TABLE `students` MODIFY COLUMN `student_status` enum('ACTIVE', 'DISCONTINUED', 'INACTIVE_ATTENDANCE') DEFAULT 'ACTIVE';
--> statement-breakpoint

-- 7. Add HOD approval columns to student_requests
ALTER TABLE `student_requests` ADD COLUMN `hod_approval_status` enum('PENDING', 'APPROVED', 'REJECTED', 'NOT_REQUIRED') DEFAULT 'NOT_REQUIRED';
--> statement-breakpoint
ALTER TABLE `student_requests` ADD COLUMN `hod_staff_id` int;
--> statement-breakpoint
ALTER TABLE `student_requests` ADD COLUMN `hod_approved_at` timestamp;
--> statement-breakpoint
ALTER TABLE `student_requests` ADD COLUMN `hod_rejection_reason` text;
--> statement-breakpoint
CREATE INDEX `idx_sr_hod_status` ON `student_requests` (`hod_approval_status`);

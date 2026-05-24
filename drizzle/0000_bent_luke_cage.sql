CREATE TABLE `academic_calendar` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` date NOT NULL,
	`academic_year` varchar(9) NOT NULL,
	`semester` tinyint NOT NULL,
	`holiday_name` varchar(255),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	`day_type` enum('WORKING','HOLIDAY','EXAM','INTERNAL','EVENT') NOT NULL DEFAULT 'WORKING',
	CONSTRAINT `academic_calendar_id_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `attendance_session_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`session_id` int NOT NULL,
	`student_id` int NOT NULL,
	`device_hash` varchar(255),
	`ip_address` varchar(45),
	`ua_hash` varchar(32),
	`status` enum('SUCCESS','FAILED_LOCATION','FAILED_EXPIRED') DEFAULT 'SUCCESS',
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `attendance_session_logs_id_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `attendance_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assignment_id` int NOT NULL,
	`attendance_date` date,
	`faculty_id` int NOT NULL,
	`session_pin` varchar(4) NOT NULL,
	`session_token` varchar(64) NOT NULL,
	`latitude` decimal(10,8),
	`longitude` decimal(11,8),
	`is_active` boolean DEFAULT true,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`session_number` int DEFAULT 1,
	`accuracy` float,
	CONSTRAINT `attendance_sessions_id_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int,
	`user_type` enum('admin','clerk','student','system') NOT NULL,
	`action` varchar(100) NOT NULL,
	`target_id` varchar(255),
	`target_type` varchar(100),
	`payload_before` json,
	`payload_after` json,
	`ip_address` varchar(45),
	`user_agent` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `audit_logs_id_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `branch_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branch` varchar(50) NOT NULL,
	`academic_year` varchar(9) NOT NULL,
	`semester` tinyint NOT NULL,
	`mid_max` int DEFAULT 20,
	`assignment_max` int DEFAULT 10,
	`is_locked` boolean DEFAULT false,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `branch_config_id_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `branch_timetable` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branch` varchar(50) NOT NULL,
	`semester` tinyint NOT NULL,
	`section` varchar(5) DEFAULT 'A',
	`day_of_week` enum('MON','TUE','WED','THU','FRI','SAT') NOT NULL,
	`period_number` int NOT NULL,
	`subject_code` varchar(50),
	`faculty_id` int,
	`academic_year` varchar(9) NOT NULL,
	`room_no` varchar(20),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `branch_timetable_id_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `certificate_verifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`request_id` int NOT NULL,
	`verification_date` timestamp DEFAULT (now()),
	`ip_address` varchar(45),
	`user_agent` text,
	CONSTRAINT `certificate_verifications_id_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clerks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`employee_id` varchar(255),
	`password_hash` varchar(255) NOT NULL,
	`role` varchar(50) NOT NULL DEFAULT 'scholarship',
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	`is_hod` boolean DEFAULT false,
	`branch` varchar(50),
	CONSTRAINT `clerks_id_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `college_info` (
	`id` int AUTO_INCREMENT NOT NULL,
	`first_sem_start_month` tinyint,
	`first_sem_start_day` tinyint,
	`second_sem_start_month` tinyint,
	`second_sem_start_day` tinyint,
	`updated_at` datetime,
	CONSTRAINT `college_info_id_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `faculty_subject_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`faculty_id` int NOT NULL,
	`subject_code` varchar(50) NOT NULL,
	`subject_name` varchar(255) NOT NULL,
	`branch` varchar(50) NOT NULL,
	`course_semester` tinyint NOT NULL,
	`academic_term` tinyint NOT NULL,
	`academic_year` varchar(9) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`is_active` boolean DEFAULT true,
	`mid_max` int DEFAULT 20,
	CONSTRAINT `faculty_subject_assignments_id_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `faculty_subject_interests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`faculty_id` int NOT NULL,
	`subject_code` varchar(50) NOT NULL,
	`subject_name` varchar(255) NOT NULL,
	`branch` varchar(50) NOT NULL,
	`semester` int NOT NULL,
	`academic_year` varchar(9) NOT NULL,
	`status` enum('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `faculty_subject_interests_id_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `otp_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roll_no` varchar(255) NOT NULL,
	`otp_code` varchar(6) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`expires_at` timestamp NOT NULL,
	CONSTRAINT `otp_codes_id_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `password_reset_tokens` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`token_hash` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`user_type` enum('student','clerk','admin') NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`expires_at` timestamp NOT NULL,
	`used_at` timestamp,
	CONSTRAINT `password_reset_tokens_id_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `principal` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `principal_id_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key_name` varchar(255) NOT NULL,
	`points` int DEFAULT 0,
	`expire_at` timestamp NOT NULL,
	CONSTRAINT `rate_limits_key_name_pk` PRIMARY KEY(`key_name`)
);
--> statement-breakpoint
CREATE TABLE `refresh_tokens` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`token_hash` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`user_type` enum('student','clerk','admin') NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`revoked_at` timestamp,
	`replaced_by_token_id` bigint unsigned,
	CONSTRAINT `refresh_tokens_id_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scholarship_sanctions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`student_id` int NOT NULL,
	`academic_year` varchar(9) NOT NULL,
	`application_no` varchar(255) NOT NULL,
	`proceeding_no` varchar(255),
	`sanctioned_amount` decimal(10,2),
	`sanction_date` date,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	`thumb_update_available` boolean DEFAULT false,
	`thumb_status` enum('PENDING','COMPLETE') DEFAULT 'PENDING',
	`hardcopy_submitted` tinyint DEFAULT 0,
	CONSTRAINT `scholarship_sanctions_id_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scholarship_windows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`academic_year` varchar(9),
	`start_date` date,
	`end_date` date,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scholarship_windows_id_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `semesters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`academic_year` varchar(9) NOT NULL,
	`semester` tinyint NOT NULL,
	`start_date` date NOT NULL,
	`end_date` date NOT NULL,
	`weekend_pattern` json NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `semesters_id_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `student_academic_background` (
	`id` int AUTO_INCREMENT NOT NULL,
	`student_id` int,
	`qualifying_exam` varchar(50),
	`previous_college_details` text,
	`medium_of_instruction` varchar(50),
	`ranks` int,
	`ssc_marks` varchar(50),
	`inter_marks` varchar(50),
	CONSTRAINT `student_academic_background_id_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `student_admission_drafts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`status` enum('DRAFT','PROCESSED','FINALIZED') NOT NULL DEFAULT 'DRAFT',
	`admission_year` varchar(9) NOT NULL,
	`entrance_exam` varchar(10) NOT NULL,
	`branch` varchar(50) NOT NULL,
	`name` varchar(255) NOT NULL,
	`father_name` varchar(255),
	`mother_name` varchar(255),
	`dob` date,
	`gender` varchar(10),
	`email` varchar(255),
	`student_mobile` varchar(20),
	`guardian_mobile` varchar(20),
	`pfp` text,
	`signature` text,
	`exam_rank` int,
	`area_status` varchar(50),
	`category` varchar(50),
	`sub_caste` varchar(100),
	`seat_allotted_category` varchar(100),
	`ssc_marks` varchar(50),
	`inter_diploma_marks` varchar(50),
	`nationality` varchar(100),
	`religion` varchar(100),
	`mother_tongue` varchar(100),
	`blood_group` varchar(10),
	`place_of_birth` varchar(255),
	`father_occupation` varchar(255),
	`annual_income` int,
	`aadhaar_no` varchar(12),
	`fee_reimbursement` enum('YES','NO','GOV'),
	`identification_mark_1` text,
	`identification_mark_2` text,
	`permanent_address` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `student_admission_drafts_id_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `student_attendance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`student_id` int NOT NULL,
	`assignment_id` int NOT NULL,
	`date` date NOT NULL,
	`session` int NOT NULL,
	`status` enum('PRESENT','ABSENT','NCC','MEDICAL') NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `student_attendance_id_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `student_fee_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`student_id` int NOT NULL,
	`academic_year` varchar(9) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`transaction_ref_no` varchar(255) NOT NULL,
	`transaction_date` date NOT NULL,
	`payment_mode` varchar(50),
	`bank_name` varchar(255),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `student_fee_payments_id_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `student_images` (
	`student_id` int NOT NULL,
	`pfp` text,
	CONSTRAINT `student_images_student_id_pk` PRIMARY KEY(`student_id`)
);
--> statement-breakpoint
CREATE TABLE `student_import_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clerk_id` int NOT NULL,
	`total_records` int NOT NULL,
	`file_name` varchar(255),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `student_import_logs_id_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `student_marks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`student_id` int NOT NULL,
	`assignment_id` int NOT NULL,
	`mid1_marks` decimal(5,2),
	`mid2_marks` decimal(5,2),
	`assignment_marks` decimal(5,2),
	`lab_theory_marks` decimal(5,2),
	`lab_execution_marks` decimal(5,2),
	`lab_record_marks` decimal(5,2),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `student_marks_id_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `student_personal_details` (
	`id` int AUTO_INCREMENT NOT NULL,
	`student_id` int,
	`father_name` varchar(255),
	`mother_name` varchar(255),
	`nationality` varchar(100),
	`religion` varchar(100),
	`category` varchar(50),
	`sub_caste` varchar(100),
	`area_status` enum('Local','Non-Local'),
	`mother_tongue` varchar(100),
	`place_of_birth` varchar(255),
	`father_occupation` varchar(255),
	`guardian_mobile` varchar(20),
	`annual_income` int,
	`aadhaar_no` varchar(12),
	`address` text,
	`seat_allotted_category` varchar(100),
	`identification_marks` text,
	`blood_group` enum('A+','A-','B+','B-','AB+','AB-','O+','O-'),
	CONSTRAINT `student_personal_details_id_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `student_profile_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`student_id` int NOT NULL,
	`new_signature` text,
	`new_pfp` text,
	`new_data` json,
	`proof_url` text,
	`status` enum('pending','approved','rejected') DEFAULT 'pending',
	`rejection_reason` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `student_profile_requests_id_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `student_request_images` (
	`request_id` int NOT NULL,
	`payment_screenshot` text,
	CONSTRAINT `student_request_images_request_id_pk` PRIMARY KEY(`request_id`)
);
--> statement-breakpoint
CREATE TABLE `student_requests` (
	`request_id` int AUTO_INCREMENT NOT NULL,
	`student_id` int NOT NULL,
	`certificate_type` varchar(100) NOT NULL,
	`purpose` text,
	`from_date` date,
	`to_date` date,
	`generated_certificate_id` varchar(50),
	`academic_year` varchar(9) NOT NULL,
	`status` enum('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
	`payment_amount` int NOT NULL,
	`transaction_id` varchar(100),
	`payment_screenshot` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	`completed_at` timestamp,
	`reject_reason` text,
	`generated_attendance` varchar(10),
	`action_by_clerk_id` int,
	`action_by_role` varchar(50),
	CONSTRAINT `student_requests_request_id_pk` PRIMARY KEY(`request_id`)
);
--> statement-breakpoint
CREATE TABLE `student_signatures` (
	`student_id` int NOT NULL,
	`signature` text,
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `student_signatures_student_id_pk` PRIMARY KEY(`student_id`)
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` int AUTO_INCREMENT NOT NULL,
	`admission_no` varchar(255),
	`roll_no` varchar(255),
	`fee_reimbursement` enum('YES','NO') NOT NULL DEFAULT 'NO',
	`name` varchar(255),
	`date_of_birth` date,
	`gender` varchar(50),
	`mobile` varchar(20),
	`email` varchar(255),
	`created_at` timestamp DEFAULT (now()),
	`is_email_verified` boolean NOT NULL DEFAULT false,
	`email_verified_at` timestamp,
	`password_hash` varchar(255),
	`added_by_clerk_id` int,
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	`updated_by_clerk_id` int,
	`student_status` enum('ACTIVE','DISCONTINUED') DEFAULT 'ACTIVE',
	CONSTRAINT `students_id_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `syllabus_structure` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branch` varchar(50) NOT NULL,
	`semester` tinyint NOT NULL,
	`subject_code` varchar(50) NOT NULL,
	`is_group` boolean DEFAULT false,
	`parent_group_code` varchar(50),
	CONSTRAINT `syllabus_structure_id_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `syllabus_subjects` (
	`subject_code` varchar(50) NOT NULL,
	`subject_name` varchar(255) NOT NULL,
	`subject_type` enum('theory','lab') NOT NULL,
	CONSTRAINT `syllabus_subjects_subject_code_pk` PRIMARY KEY(`subject_code`)
);
--> statement-breakpoint
CREATE TABLE `syllabus_units` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subject_code` varchar(50) NOT NULL,
	`unit_order` tinyint NOT NULL,
	`unit_name` varchar(255) NOT NULL,
	`topics` json NOT NULL,
	CONSTRAINT `syllabus_units_id_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_date` ON `academic_calendar` (`date`);--> statement-breakpoint
CREATE INDEX `idx_ay_sem` ON `academic_calendar` (`academic_year`,`semester`);--> statement-breakpoint
CREATE INDEX `idx_session_ip_ua` ON `attendance_session_logs` (`session_id`,`ip_address`,`ua_hash`);--> statement-breakpoint
CREATE INDEX `idx_asl_student_session` ON `attendance_session_logs` (`student_id`,`session_id`);--> statement-breakpoint
CREATE INDEX `idx_assignment_active` ON `attendance_sessions` (`assignment_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `idx_sessions_active` ON `attendance_sessions` (`is_active`,`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_session_token` ON `attendance_sessions` (`session_token`);--> statement-breakpoint
CREATE INDEX `idx_audit_action` ON `audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `idx_audit_user` ON `audit_logs` (`user_id`,`user_type`);--> statement-breakpoint
CREATE INDEX `idx_audit_target` ON `audit_logs` (`target_id`,`target_type`);--> statement-breakpoint
CREATE INDEX `idx_bc_lookup` ON `branch_config` (`branch`,`academic_year`,`semester`);--> statement-breakpoint
CREATE INDEX `idx_timetable_lookup` ON `branch_timetable` (`branch`,`semester`,`academic_year`);--> statement-breakpoint
CREATE INDEX `idx_bt_day_period` ON `branch_timetable` (`day_of_week`,`period_number`);--> statement-breakpoint
CREATE INDEX `idx_cv_request` ON `certificate_verifications` (`request_id`);--> statement-breakpoint
CREATE INDEX `idx_clerks_email` ON `clerks` (`email`);--> statement-breakpoint
CREATE INDEX `idx_clerks_employee_id` ON `clerks` (`employee_id`);--> statement-breakpoint
CREATE INDEX `idx_faculty_subject_active` ON `faculty_subject_assignments` (`branch`,`is_active`);--> statement-breakpoint
CREATE INDEX `idx_fsa_branch_sem` ON `faculty_subject_assignments` (`branch`,`course_semester`);--> statement-breakpoint
CREATE INDEX `idx_fsa_faculty` ON `faculty_subject_assignments` (`faculty_id`);--> statement-breakpoint
CREATE INDEX `idx_fsi_faculty` ON `faculty_subject_interests` (`faculty_id`);--> statement-breakpoint
CREATE INDEX `idx_fsi_status` ON `faculty_subject_interests` (`status`);--> statement-breakpoint
CREATE INDEX `idx_otp_roll_no` ON `otp_codes` (`roll_no`);--> statement-breakpoint
CREATE INDEX `idx_password_reset_user` ON `password_reset_tokens` (`user_id`,`user_type`);--> statement-breakpoint
CREATE INDEX `idx_password_reset_expiry` ON `password_reset_tokens` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_principal_email` ON `principal` (`email`);--> statement-breakpoint
CREATE INDEX `idx_expire` ON `rate_limits` (`expire_at`);--> statement-breakpoint
CREATE INDEX `idx_refresh_token_hash` ON `refresh_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_refresh_user` ON `refresh_tokens` (`user_id`,`user_type`);--> statement-breakpoint
CREATE INDEX `idx_scholarship_app_year` ON `scholarship_sanctions` (`application_no`,`academic_year`);--> statement-breakpoint
CREATE INDEX `idx_scholarship_search` ON `scholarship_sanctions` (`student_id`,`academic_year`);--> statement-breakpoint
CREATE INDEX `idx_sab_student_id` ON `student_academic_background` (`student_id`);--> statement-breakpoint
CREATE INDEX `idx_draft_email` ON `student_admission_drafts` (`email`);--> statement-breakpoint
CREATE INDEX `idx_draft_mobile` ON `student_admission_drafts` (`student_mobile`);--> statement-breakpoint
CREATE INDEX `idx_draft_status` ON `student_admission_drafts` (`status`);--> statement-breakpoint
CREATE INDEX `idx_attendance_lookup` ON `student_attendance` (`assignment_id`,`date`,`session`);--> statement-breakpoint
CREATE INDEX `idx_student_attendance_history` ON `student_attendance` (`student_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_sa_student_assignment` ON `student_attendance` (`student_id`,`assignment_id`);--> statement-breakpoint
CREATE INDEX `idx_sfp_student` ON `student_fee_payments` (`student_id`);--> statement-breakpoint
CREATE INDEX `idx_si_student` ON `student_images` (`student_id`);--> statement-breakpoint
CREATE INDEX `idx_import_created_at` ON `student_import_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_marks_student_assignment` ON `student_marks` (`student_id`,`assignment_id`);--> statement-breakpoint
CREATE INDEX `idx_spd_student_id` ON `student_personal_details` (`student_id`);--> statement-breakpoint
CREATE INDEX `idx_spd_aadhaar` ON `student_personal_details` (`aadhaar_no`);--> statement-breakpoint
CREATE INDEX `idx_spr_student` ON `student_profile_requests` (`student_id`);--> statement-breakpoint
CREATE INDEX `idx_spr_status` ON `student_profile_requests` (`status`);--> statement-breakpoint
CREATE INDEX `idx_sri_request` ON `student_request_images` (`request_id`);--> statement-breakpoint
CREATE INDEX `idx_gen_cert_id` ON `student_requests` (`generated_certificate_id`);--> statement-breakpoint
CREATE INDEX `idx_sr_student` ON `student_requests` (`student_id`);--> statement-breakpoint
CREATE INDEX `idx_sr_status` ON `student_requests` (`status`);--> statement-breakpoint
CREATE INDEX `idx_ss_student` ON `student_signatures` (`student_id`);--> statement-breakpoint
CREATE INDEX `idx_roll_no` ON `students` (`roll_no`);--> statement-breakpoint
CREATE INDEX `idx_students_email` ON `students` (`email`);--> statement-breakpoint
CREATE INDEX `idx_students_mobile` ON `students` (`mobile`);--> statement-breakpoint
CREATE INDEX `idx_students_created_at` ON `students` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_students_updated_at` ON `students` (`updated_at`);--> statement-breakpoint
CREATE INDEX `branch` ON `syllabus_structure` (`branch`,`semester`);--> statement-breakpoint
CREATE INDEX `subject_code` ON `syllabus_structure` (`subject_code`);--> statement-breakpoint
CREATE INDEX `idx_su_subject` ON `syllabus_units` (`subject_code`);
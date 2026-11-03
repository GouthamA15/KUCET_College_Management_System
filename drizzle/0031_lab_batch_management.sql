-- Migration: 0031_lab_batch_management.sql
-- Description: Implement Lab-Wise Student Batch Allocation & Scheduling Engine.
-- Adds batch_number to branch_timetable and attendance_sessions, introduces lab_batch_allocations,
-- lab_batch_students, timetable_slot_faculty, and lab_batch_allocation_audit_logs.

CREATE TABLE IF NOT EXISTS `lab_batch_allocations` (
  `id` int AUTO_INCREMENT NOT NULL,
  `academic_year` varchar(9) NOT NULL,
  `branch` varchar(50) NOT NULL,
  `semester` tinyint NOT NULL,
  `subject_code` varchar(50) NOT NULL,
  `batch_1_name` varchar(50) NOT NULL DEFAULT 'Batch 1',
  `batch_2_name` varchar(50) NOT NULL DEFAULT 'Batch 2',
  `status` enum('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `version` int NOT NULL DEFAULT 1,
  `created_by_staff_id` int NULL,
  `published_at` timestamp NULL DEFAULT NULL,
  `change_reason` text NULL,
  `created_at` timestamp DEFAULT (now()),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `pk_lab_batch_allocations` PRIMARY KEY(`id`),
  CONSTRAINT `uq_lab_allocation_version` UNIQUE(`academic_year`, `branch`, `semester`, `subject_code`, `version`),
  INDEX `idx_lba_cohort` (`branch`, `semester`, `academic_year`),
  INDEX `idx_lba_active` (`academic_year`, `branch`, `semester`, `subject_code`, `status`)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `lab_batch_students` (
  `id` int AUTO_INCREMENT NOT NULL,
  `allocation_id` int NOT NULL,
  `student_id` int NOT NULL,
  `batch_number` tinyint NOT NULL,
  `created_at` timestamp DEFAULT (now()),
  CONSTRAINT `pk_lab_batch_students` PRIMARY KEY(`id`),
  CONSTRAINT `uq_allocation_student` UNIQUE(`allocation_id`, `student_id`),
  CONSTRAINT `fk_lbs_allocation` FOREIGN KEY (`allocation_id`) REFERENCES `lab_batch_allocations`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_lbs_student` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE,
  INDEX `idx_lbs_student` (`student_id`),
  INDEX `idx_lbs_alloc_batch` (`allocation_id`, `batch_number`)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `timetable_slot_faculty` (
  `id` int AUTO_INCREMENT NOT NULL,
  `slot_id` int NOT NULL,
  `faculty_id` int NOT NULL,
  `is_primary` boolean NOT NULL DEFAULT false,
  `role` varchar(50) NOT NULL DEFAULT 'INSTRUCTOR',
  `created_at` timestamp DEFAULT (now()),
  CONSTRAINT `pk_timetable_slot_faculty` PRIMARY KEY(`id`),
  CONSTRAINT `uq_slot_faculty` UNIQUE(`slot_id`, `faculty_id`),
  CONSTRAINT `fk_tsf_slot` FOREIGN KEY (`slot_id`) REFERENCES `branch_timetable`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tsf_faculty` FOREIGN KEY (`faculty_id`) REFERENCES `staff_accounts`(`id`) ON DELETE CASCADE,
  INDEX `idx_tsf_faculty` (`faculty_id`)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `lab_batch_allocation_audit_logs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `allocation_id` int NOT NULL,
  `version` int NOT NULL,
  `action` enum('CREATED', 'UPDATED', 'PUBLISHED', 'ARCHIVED') NOT NULL,
  `performed_by_staff_id` int NOT NULL,
  `reason` text NULL,
  `metadata` json NULL,
  `created_at` timestamp DEFAULT (now()),
  CONSTRAINT `pk_lab_batch_allocation_audit_logs` PRIMARY KEY(`id`),
  INDEX `idx_lba_log_alloc` (`allocation_id`),
  INDEX `idx_lba_log_staff` (`performed_by_staff_id`)
);
--> statement-breakpoint

SET @add_bt_col = (
  SELECT IF(
    NOT EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'branch_timetable'
        AND column_name = 'batch_number'
    ),
    'ALTER TABLE `branch_timetable` ADD COLUMN `batch_number` tinyint NOT NULL DEFAULT 0 AFTER `period_number`',
    'DO 0'
  )
);
--> statement-breakpoint
PREPARE stmt_add_bt_col FROM @add_bt_col;
--> statement-breakpoint
EXECUTE stmt_add_bt_col;
--> statement-breakpoint
DEALLOCATE PREPARE stmt_add_bt_col;
--> statement-breakpoint

SET @drop_bt_idx = (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'branch_timetable'
        AND index_name = 'uq_timetable_slot'
    ),
    'ALTER TABLE `branch_timetable` DROP INDEX `uq_timetable_slot`',
    'DO 0'
  )
);
--> statement-breakpoint
PREPARE stmt_drop_bt_idx FROM @drop_bt_idx;
--> statement-breakpoint
EXECUTE stmt_drop_bt_idx;
--> statement-breakpoint
DEALLOCATE PREPARE stmt_drop_bt_idx;
--> statement-breakpoint

SET @create_bt_idx = (
  SELECT IF(
    NOT EXISTS(
      SELECT 1 FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'branch_timetable'
        AND index_name = 'uq_timetable_slot_batch'
    ),
    'CREATE UNIQUE INDEX `uq_timetable_slot_batch` ON `branch_timetable` (`branch`, `semester`, `day_of_week`, `period_number`, `academic_year`, `batch_number`)',
    'DO 0'
  )
);
--> statement-breakpoint
PREPARE stmt_create_bt_idx FROM @create_bt_idx;
--> statement-breakpoint
EXECUTE stmt_create_bt_idx;
--> statement-breakpoint
DEALLOCATE PREPARE stmt_create_bt_idx;
--> statement-breakpoint

SET @add_as_batch_col = (
  SELECT IF(
    NOT EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'attendance_sessions'
        AND column_name = 'batch_number'
    ),
    'ALTER TABLE `attendance_sessions` ADD COLUMN `batch_number` tinyint NOT NULL DEFAULT 0 AFTER `session_number`',
    'DO 0'
  )
);
--> statement-breakpoint
PREPARE stmt_add_as_batch FROM @add_as_batch_col;
--> statement-breakpoint
EXECUTE stmt_add_as_batch;
--> statement-breakpoint
DEALLOCATE PREPARE stmt_add_as_batch;
--> statement-breakpoint

SET @add_as_alloc_col = (
  SELECT IF(
    NOT EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'attendance_sessions'
        AND column_name = 'allocation_id'
    ),
    'ALTER TABLE `attendance_sessions` ADD COLUMN `allocation_id` int NULL DEFAULT NULL AFTER `batch_number`',
    'DO 0'
  )
);
--> statement-breakpoint
PREPARE stmt_add_as_alloc FROM @add_as_alloc_col;
--> statement-breakpoint
EXECUTE stmt_add_as_alloc;
--> statement-breakpoint
DEALLOCATE PREPARE stmt_add_as_alloc;
--> statement-breakpoint

SET @drop_as_slot_idx = (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'attendance_sessions'
        AND index_name = 'uq_assignment_session_slot'
    ),
    'ALTER TABLE `attendance_sessions` DROP INDEX `uq_assignment_session_slot`',
    'DO 0'
  )
);
--> statement-breakpoint
PREPARE stmt_drop_as_idx FROM @drop_as_slot_idx;
--> statement-breakpoint
EXECUTE stmt_drop_as_idx;
--> statement-breakpoint
DEALLOCATE PREPARE stmt_drop_as_idx;
--> statement-breakpoint

SET @create_as_batch_idx = (
  SELECT IF(
    NOT EXISTS(
      SELECT 1 FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'attendance_sessions'
        AND index_name = 'uq_assignment_session_slot_batch'
    ),
    'CREATE UNIQUE INDEX `uq_assignment_session_slot_batch` ON `attendance_sessions` (`assignment_id`, `attendance_date`, `session_number`, `batch_number`)',
    'DO 0'
  )
);
--> statement-breakpoint
PREPARE stmt_create_as_idx FROM @create_as_batch_idx;
--> statement-breakpoint
EXECUTE stmt_create_as_idx;
--> statement-breakpoint
DEALLOCATE PREPARE stmt_create_as_idx;
--> statement-breakpoint

SET @create_as_alloc_idx = (
  SELECT IF(
    NOT EXISTS(
      SELECT 1 FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'attendance_sessions'
        AND index_name = 'idx_as_allocation'
    ),
    'CREATE INDEX `idx_as_allocation` ON `attendance_sessions` (`allocation_id`)',
    'DO 0'
  )
);
--> statement-breakpoint
PREPARE stmt_create_as_alloc_idx FROM @create_as_alloc_idx;
--> statement-breakpoint
EXECUTE stmt_create_as_alloc_idx;
--> statement-breakpoint
DEALLOCATE PREPARE stmt_create_as_alloc_idx;

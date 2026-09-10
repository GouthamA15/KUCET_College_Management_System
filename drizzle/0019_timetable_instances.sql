-- Migration 0019: Timetable Instances and Branch Timetable Association
CREATE TABLE IF NOT EXISTS `timetable_instances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branch` varchar(50) NOT NULL,
	`semester` tinyint NOT NULL,
	`academic_year` varchar(9) NOT NULL,
	`status` enum('DRAFT','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
	`created_by` int,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	`published_at` timestamp,
	`updated_by` int,
	CONSTRAINT `timetable_instances_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_timetable_instance` UNIQUE(`branch`,`semester`,`academic_year`)
);
--> statement-breakpoint
ALTER TABLE `branch_timetable` ADD COLUMN `timetable_instance_id` int NULL;
--> statement-breakpoint
CREATE INDEX `idx_bt_instance` ON `branch_timetable` (`timetable_instance_id`);

CREATE TABLE IF NOT EXISTS `database_backup_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`filename` varchar(255) NOT NULL,
	`file_path` varchar(500) NOT NULL,
	`file_size_bytes` bigint,
	`checksum_sha256` varchar(64),
	`backup_type` enum('SCHEDULED','MANUAL','EMERGENCY_PRE_RESTORE') NOT NULL DEFAULT 'SCHEDULED',
	`status` enum('IN_PROGRESS','SUCCESS','FAILED') NOT NULL DEFAULT 'IN_PROGRESS',
	`error_message` text,
	`duration_ms` int,
	`triggered_by` varchar(255) NOT NULL DEFAULT 'SYSTEM_CRON',
	`created_at` timestamp DEFAULT (now()),
	`completed_at` timestamp,
	CONSTRAINT `database_backup_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_backup_filename` ON `database_backup_logs` (`filename`);--> statement-breakpoint
CREATE INDEX `idx_backup_status` ON `database_backup_logs` (`status`);--> statement-breakpoint
CREATE INDEX `idx_backup_created_at` ON `database_backup_logs` (`created_at`);

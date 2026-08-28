UPDATE `audit_logs` SET `user_type` = 'staff' WHERE `user_type` = 'clerk' OR `user_type` = 'CLERK' OR `user_type` = 'STAFF';--> statement-breakpoint
UPDATE `bug_reports` SET `user_type` = 'staff' WHERE `user_type` = 'clerk' OR `user_type` = 'CLERK';--> statement-breakpoint
UPDATE `notification_preferences` SET `user_type` = 'staff' WHERE `user_type` = 'clerk' OR `user_type` = 'CLERK';--> statement-breakpoint
UPDATE `password_reset_tokens` SET `user_type` = 'staff' WHERE `user_type` = 'clerk' OR `user_type` = 'CLERK';--> statement-breakpoint
UPDATE `push_subscriptions` SET `user_type` = 'staff' WHERE `user_type` = 'clerk' OR `user_type` = 'CLERK';--> statement-breakpoint
ALTER TABLE `audit_logs` MODIFY COLUMN `user_type` enum('admin','staff','student','system') NOT NULL;--> statement-breakpoint
ALTER TABLE `bug_reports` MODIFY COLUMN `user_type` enum('student','staff','admin') NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_preferences` MODIFY COLUMN `user_type` enum('student','staff','faculty','hod','admin') NOT NULL;--> statement-breakpoint
ALTER TABLE `password_reset_tokens` MODIFY COLUMN `user_type` enum('student','staff','admin') NOT NULL;--> statement-breakpoint
ALTER TABLE `push_subscriptions` MODIFY COLUMN `user_type` enum('student','staff','faculty','hod','admin') NOT NULL;--> statement-breakpoint
DROP TABLE IF EXISTS `clerk_registration_requests`;--> statement-breakpoint
DROP TABLE IF EXISTS `clerks`;

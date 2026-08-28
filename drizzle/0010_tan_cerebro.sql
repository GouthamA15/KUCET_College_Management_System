CREATE TABLE `notification_preferences` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`user_type` enum('student','clerk','faculty','hod','admin') NOT NULL,
	`categories` json NOT NULL,
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `notification_preferences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`user_type` enum('student','clerk','faculty','hod','admin') NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth_secret` text NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `push_subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_notif_pref_user` ON `notification_preferences` (`user_id`,`user_type`);--> statement-breakpoint
CREATE INDEX `idx_push_sub_user` ON `push_subscriptions` (`user_id`,`user_type`);
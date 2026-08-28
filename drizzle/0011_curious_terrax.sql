CREATE TABLE `assistant_conversations` (
	`id` varchar(64) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`role` varchar(50) NOT NULL,
	`title` varchar(255) NOT NULL DEFAULT 'New Conversation',
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assistant_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `assistant_messages` (
	`id` varchar(64) NOT NULL,
	`conversation_id` varchar(64) NOT NULL,
	`sender` enum('user','assistant') NOT NULL,
	`message` text NOT NULL,
	`metadata` json,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `assistant_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_ac_user_id` ON `assistant_conversations` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_am_conv_id` ON `assistant_messages` (`conversation_id`);--> statement-breakpoint
ALTER TABLE `student_requests` DROP COLUMN `payment_screenshot`;
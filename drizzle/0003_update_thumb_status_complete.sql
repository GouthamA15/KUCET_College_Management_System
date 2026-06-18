ALTER TABLE `scholarship_sanctions`
  MODIFY COLUMN `thumb_status` enum('PENDING','COMPLETE','COMPLETED','FAILED') DEFAULT 'PENDING';
--> statement-breakpoint
UPDATE `scholarship_sanctions`
SET `thumb_status` = 'COMPLETED'
WHERE `thumb_status` = 'COMPLETE';
--> statement-breakpoint
ALTER TABLE `scholarship_sanctions`
  MODIFY COLUMN `thumb_status` enum('PENDING','COMPLETED','FAILED') DEFAULT 'PENDING';

ALTER TABLE `student_academic_background` MODIFY COLUMN `student_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `student_personal_details` MODIFY COLUMN `student_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `student_marks` ADD `is_published` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `student_marks` ADD CONSTRAINT `uq_marks_student_assignment` UNIQUE(`student_id`,`assignment_id`);
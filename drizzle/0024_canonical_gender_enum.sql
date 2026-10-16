-- Migration: 0024_canonical_gender_enum.sql
-- Description: Standardize gender values to canonical uppercase 'MALE' and 'FEMALE', completely removing 'OTHER' across identity, registry, and archive schemas.

UPDATE `student_admission_drafts`
SET `gender` = 'MALE'
WHERE `gender` = 'Male';
--> statement-breakpoint
UPDATE `student_admission_drafts`
SET `gender` = 'FEMALE'
WHERE `gender` = 'Female';
--> statement-breakpoint
ALTER TABLE `student_admission_drafts`
MODIFY COLUMN `gender` enum('MALE', 'FEMALE');
--> statement-breakpoint
ALTER TABLE `archive_student_personal_details`
MODIFY COLUMN `gender` enum('MALE', 'FEMALE');
--> statement-breakpoint
UPDATE `students`
SET `gender` = 'MALE'
WHERE `gender` IN ('Male', 'M', ' M');
--> statement-breakpoint
UPDATE `students`
SET `gender` = 'FEMALE'
WHERE `gender` IN ('Female', 'F');
--> statement-breakpoint
ALTER TABLE `students`
MODIFY COLUMN `gender` enum('MALE', 'FEMALE');
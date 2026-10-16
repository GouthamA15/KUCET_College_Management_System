-- Migration: 0024_canonical_gender_enum.sql
-- Description: Standardize gender values to canonical uppercase 'MALE' and 'FEMALE', completely removing 'OTHER' across identity, registry, and archive schemas.

-- Temporarily disable Safe Update Mode
SET SQL_SAFE_UPDATES = 0;

-- Your existing migration starts here

UPDATE `student_admission_drafts`
SET `gender` = 'MALE'
WHERE `gender` = 'Male';

UPDATE `student_admission_drafts`
SET `gender` = 'FEMALE'
WHERE `gender` = 'Female';

ALTER TABLE `student_admission_drafts`
MODIFY COLUMN `gender` ENUM('MALE', 'FEMALE');

ALTER TABLE `archive_student_personal_details`
MODIFY COLUMN `gender` ENUM('MALE', 'FEMALE');

UPDATE `students`
SET `gender` = 'MALE'
WHERE `gender` IN ('Male', 'M', ' M');

UPDATE `students`
SET `gender` = 'FEMALE'
WHERE `gender` IN ('Female', 'F');

ALTER TABLE `students`
ADD CONSTRAINT `chk_student_gender`
CHECK (`gender` IN ('MALE', 'FEMALE', 'N/A', 'P'));

-- Re-enable Safe Update Mode
SET SQL_SAFE_UPDATES = 1;
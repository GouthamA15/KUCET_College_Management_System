-- Migration: 0024_canonical_gender_enum.sql
-- Description: Standardize gender values to canonical uppercase 'MALE' and 'FEMALE', completely removing 'OTHER' across identity, registry, and archive schemas.

-- 1. Enable check constraints globally for TiDB
SET @@global.tidb_enable_check_constraint = ON;

-- 2. Normalize registry table (student_admission_drafts) and alter column to ENUM('MALE', 'FEMALE')
UPDATE `student_admission_drafts` SET `gender` = 'MALE' WHERE `gender` = 'Male';
UPDATE `student_admission_drafts` SET `gender` = 'FEMALE' WHERE `gender` = 'Female';
ALTER TABLE `student_admission_drafts` MODIFY COLUMN `gender` enum('MALE','FEMALE');

-- 3. Archive table (archive_student_personal_details) alter column to ENUM('MALE', 'FEMALE')
ALTER TABLE `archive_student_personal_details` MODIFY COLUMN `gender` enum('MALE','FEMALE');

-- 4. Identity table (students) - Normalize case variations while preserving legacy 'N/A' and 'P' records without data loss or invented classification
UPDATE `students` SET `gender` = 'MALE' WHERE `gender` IN ('Male', 'M', ' M');
UPDATE `students` SET `gender` = 'FEMALE' WHERE `gender` IN ('Female', 'F');

-- 5. Add database check constraint to enforce only 'MALE', 'FEMALE', or preserved legacy values, strictly rejecting 'OTHER'
ALTER TABLE `students` ADD CONSTRAINT `chk_student_gender` CHECK (`gender` IN ('MALE', 'FEMALE', 'N/A', 'P'));

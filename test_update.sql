-- MySQL update script for Student Management changes
-- Adds SSC and Inter/Diploma marks to student_academic_background

ALTER TABLE `student_academic_background` 
ADD COLUMN `ssc_marks` varchar(50) DEFAULT NULL AFTER `ranks`,
ADD COLUMN `inter_marks` varchar(50) DEFAULT NULL AFTER `ssc_marks`;

ALTER TABLE `student_personal_details`
ADD COLUMN `guardian_mobile` varchar(20) DEFAULT NULL AFTER `father_occupation`;

-- Note: student_images and student_signatures tables already exist with MEDIUMBLOB
-- student_images (student_id, pfp)
-- student_signatures (student_id, signature, updated_at)

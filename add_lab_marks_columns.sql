-- SQL Migration for Lab Marks Support (Reuse Existing Columns)
-- Run this on your database to enable lab-specific marking

-- 1. Add subject_type to assignments table to distinguish Theory vs Lab
ALTER TABLE faculty_subject_assignments 
ADD COLUMN subject_type ENUM('theory', 'lab') DEFAULT 'theory' AFTER subject_name;

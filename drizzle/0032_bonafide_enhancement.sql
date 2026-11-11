-- Migration: 0032_bonafide_enhancement.sql
-- Description: Add immutable snapshot columns for Bonafide Certificate enhancements to student_requests.
-- Columns: certificate_format, study_year, study_semester, admission_type, years_at_kucet.

ALTER TABLE `student_requests` ADD COLUMN `certificate_format` varchar(20);
--> statement-breakpoint
ALTER TABLE `student_requests` ADD COLUMN `study_year` int;
--> statement-breakpoint
ALTER TABLE `student_requests` ADD COLUMN `study_semester` int;
--> statement-breakpoint
ALTER TABLE `student_requests` ADD COLUMN `admission_type` varchar(20);
--> statement-breakpoint
ALTER TABLE `student_requests` ADD COLUMN `years_at_kucet` int;
--> statement-breakpoint

-- Backfill study_semester for historical Bonafide requests matching EXACTLY ONE semester.
-- Requests matching 0 or >1 semesters remain NULL.
UPDATE `student_requests` sr
JOIN (
  SELECT
    sr_sub.request_id,
    MIN(sem.semester) AS matched_semester
  FROM `student_requests` sr_sub
  JOIN `semesters` sem ON (
    sr_sub.created_at BETWEEN sem.start_date AND sem.end_date
    AND sr_sub.academic_year = sem.academic_year
  )
  WHERE sr_sub.certificate_type = 'Bonafide Certificate'
  GROUP BY sr_sub.request_id
  HAVING COUNT(*) = 1
) unique_sem ON sr.request_id = unique_sem.request_id
SET sr.study_semester = unique_sem.matched_semester;

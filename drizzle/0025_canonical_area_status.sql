-- Migration: 0025_canonical_area_status.sql
-- Description: Standardize area_status values to canonical 'Local' and 'Non-Local' in student_admission_drafts.

UPDATE `student_admission_drafts`
SET `area_status` = 'Non-Local'
WHERE `area_status` IN ('NON-LOCAL', 'Non Local', 'non-local', 'non local');
--> statement-breakpoint
UPDATE `student_admission_drafts`
SET `area_status` = 'Local'
WHERE `area_status` IN ('LOCAL', 'local');

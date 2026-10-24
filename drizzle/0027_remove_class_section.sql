-- Migration: 0027_remove_class_section.sql
-- Description: Repository-wide removal of class section concept. Drop section column and enforce canonical unique constraint (branch, semester, day_of_week, period_number, academic_year).

ALTER TABLE `branch_timetable` DROP INDEX IF EXISTS `uq_timetable_slot`;
--> statement-breakpoint
ALTER TABLE `branch_timetable` DROP COLUMN `section`;
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_timetable_slot` ON `branch_timetable` (`branch`, `semester`, `day_of_week`, `period_number`, `academic_year`);

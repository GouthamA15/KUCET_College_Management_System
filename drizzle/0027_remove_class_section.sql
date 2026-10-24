-- Migration: 0027_remove_class_section.sql
-- Description: Repository-wide removal of class section concept. Drop section column and enforce canonical unique constraint (branch, semester, day_of_week, period_number, academic_year).

SET @drop_index_stmt = (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'branch_timetable'
        AND index_name = 'uq_timetable_slot'
    ) AND (
      SELECT COALESCE(GROUP_CONCAT(column_name ORDER BY seq_in_index), '')
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'branch_timetable'
        AND index_name = 'uq_timetable_slot'
    ) != 'branch,semester,day_of_week,period_number,academic_year',
    'ALTER TABLE `branch_timetable` DROP INDEX `uq_timetable_slot`',
    'DO 0'
  )
);
--> statement-breakpoint
PREPARE stmt_drop_idx FROM @drop_index_stmt;
--> statement-breakpoint
EXECUTE stmt_drop_idx;
--> statement-breakpoint
DEALLOCATE PREPARE stmt_drop_idx;
--> statement-breakpoint
SET @drop_column_stmt = (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'branch_timetable'
        AND column_name = 'section'
    ),
    'ALTER TABLE `branch_timetable` DROP COLUMN `section`',
    'DO 0'
  )
);
--> statement-breakpoint
PREPARE stmt_drop_col FROM @drop_column_stmt;
--> statement-breakpoint
EXECUTE stmt_drop_col;
--> statement-breakpoint
DEALLOCATE PREPARE stmt_drop_col;
--> statement-breakpoint
SET @create_index_stmt = (
  SELECT IF(
    NOT EXISTS(
      SELECT 1 FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'branch_timetable'
        AND index_name = 'uq_timetable_slot'
    ),
    'CREATE UNIQUE INDEX `uq_timetable_slot` ON `branch_timetable` (`branch`, `semester`, `day_of_week`, `period_number`, `academic_year`)',
    'DO 0'
  )
);
--> statement-breakpoint
PREPARE stmt_create_idx FROM @create_index_stmt;
--> statement-breakpoint
EXECUTE stmt_create_idx;
--> statement-breakpoint
DEALLOCATE PREPARE stmt_create_idx;

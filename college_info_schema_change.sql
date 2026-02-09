
ALTER TABLE `college_info`
DROP COLUMN `first_sem_start_date`,
DROP COLUMN `second_sem_start_date`,
ADD COLUMN `first_sem_start_month` TINYINT DEFAULT NULL AFTER `id`,
ADD COLUMN `first_sem_start_day` TINYINT DEFAULT NULL AFTER `first_sem_start_month`,
ADD COLUMN `second_sem_start_month` TINYINT DEFAULT NULL AFTER `first_sem_start_day`,
ADD COLUMN `second_sem_start_day` TINYINT DEFAULT NULL AFTER `second_sem_start_month`;

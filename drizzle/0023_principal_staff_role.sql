-- Migration: 0023_principal_staff_role.sql
-- Description: Add PRINCIPAL staff role for institutional supervisor across CSE, IT, and CSD

INSERT INTO `staff_roles` (`role_code`, `role_name`, `description`) 
VALUES ('PRINCIPAL', 'Principal / Academic Supervisor', 'Principal-level institutional supervisor with oversight across CSE, IT, and CSD')
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`), `role_name` = VALUES(`role_name`);

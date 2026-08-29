-- Migration 0017: Add address column to staff_registration_requests
ALTER TABLE `staff_registration_requests` ADD COLUMN `address` text NULL AFTER `designation`;

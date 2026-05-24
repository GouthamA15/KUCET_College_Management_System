-- Migration 0002: Add address field to clerks
ALTER TABLE `clerks` ADD `address` text;

CREATE TABLE `otp_codes` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `roll_no` VARCHAR(255) NOT NULL,
  `otp_code` VARCHAR(6) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `expires_at` TIMESTAMP NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_roll_no_otp` (`roll_no`), -- Ensures only one active OTP per roll_no
  CONSTRAINT `fk_otp_roll_no` FOREIGN KEY (`roll_no`) REFERENCES `students` (`roll_no`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

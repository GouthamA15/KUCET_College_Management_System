-- Password Reset Tokens Table
CREATE TABLE `password_reset_tokens` (
  `token` varchar(255) NOT NULL,
  `user_id` varchar(255) NOT NULL,
  `user_type` enum('student','clerk','admin') NOT NULL,
  `expires_at` timestamp NOT NULL,
  PRIMARY KEY (`token`),
  KEY `user_id_idx` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

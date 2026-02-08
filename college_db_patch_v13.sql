CREATE TABLE IF NOT EXISTS college_info (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_sem_start_date DATE NULL,
    second_sem_start_date DATE NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO college_info (id, first_sem_start_date, second_sem_start_date) VALUES (1, NULL, NULL)
ON DUPLICATE KEY UPDATE
    first_sem_start_date = VALUES(first_sem_start_date),
    second_sem_start_date = VALUES(second_sem_start_date);
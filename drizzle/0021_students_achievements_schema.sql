CREATE TABLE student_achievements (
    id INT NOT NULL AUTO_INCREMENT,

    student_id INT NOT NULL,

    achievement_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    program_name VARCHAR(255) DEFAULT NULL,
    issuing_organization VARCHAR(255) DEFAULT NULL,

    academic_year VARCHAR(9) NOT NULL,

    achievement_date DATE DEFAULT NULL,
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL,

    achievement_level VARCHAR(50) DEFAULT NULL,
    recognition VARCHAR(100) DEFAULT NULL,

    description TEXT DEFAULT NULL,

    certificate_file_path VARCHAR(500) DEFAULT NULL,
    certificate_mime_type VARCHAR(100) DEFAULT NULL,

    additional_data JSON DEFAULT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_achievement_student (student_id),
    KEY idx_achievement_type (achievement_type),
    KEY idx_achievement_academic_year (academic_year),
    KEY idx_achievement_date (achievement_date),
    KEY idx_achievement_student_year (student_id, academic_year),

    CONSTRAINT fk_achievement_student
        FOREIGN KEY (student_id)
        REFERENCES students(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;
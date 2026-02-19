-- Schema for the new student admission draft process

CREATE TABLE `student_admission_drafts` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `status` ENUM('DRAFT', 'PROCESSED') NOT NULL DEFAULT 'DRAFT',
  
  -- Core Details
  `admission_year` VARCHAR(9) NOT NULL,
  `entrance_exam` VARCHAR(10) NOT NULL, -- EAMCET, ECET
  `branch` VARCHAR(50) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `father_name` VARCHAR(255) NULL,
  `mother_name` VARCHAR(255) NULL,
  `dob` DATE NULL,
  `gender` VARCHAR(10) NULL,
  `email` VARCHAR(255) NULL,
  `student_mobile` VARCHAR(20) NULL,
  `guardian_mobile` VARCHAR(20) NULL,
  
  -- Photo & Signature
  `pfp` MEDIUMBLOB NULL,
  `signature` MEDIUMBLOB NULL,
  
  -- Academic & Category Details
  `exam_rank` INT NULL,
  `area_status` VARCHAR(50) NULL, -- Local / Non Local
  `category` VARCHAR(50) NULL,
  `sub_caste` VARCHAR(100) NULL,
  `seat_allotted_category` VARCHAR(100) NULL,
  `ssc_marks` VARCHAR(50) NULL,
  `inter_diploma_marks` VARCHAR(50) NULL,
  
  -- Personal Details
  `nationality` VARCHAR(100) NULL,
  `religion` VARCHAR(100) NULL,
  `mother_tongue` VARCHAR(100) NULL,
  `blood_group` VARCHAR(10) NULL,
  `place_of_birth` VARCHAR(255) NULL,
  `father_occupation` VARCHAR(255) NULL,
  `annual_income` INT NULL,
  `aadhaar_no` VARCHAR(12) NULL,
  `fee_reimbursement` ENUM('YES', 'NO', 'GOV') NULL,
  
  -- Address & Identification
  `identification_mark_1` TEXT NULL,
  `identification_mark_2` TEXT NULL,
  `permanent_address` TEXT NULL,
  
  -- Timestamps
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`id`),
  KEY `idx_status_branch` (`status`, `branch`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

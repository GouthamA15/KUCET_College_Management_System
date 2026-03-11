-- HOD Role & Department Management Migration v1
-- KUCET College Management System

-- 1. Update Clerks table to support HOD identification and Branch assignment
ALTER TABLE clerks 
ADD COLUMN is_hod TINYINT(1) DEFAULT 0,
ADD COLUMN branch VARCHAR(50) DEFAULT NULL;

-- 2. Create Branch Configuration table (for Marks Pattern 20+10 vs 25+5)
CREATE TABLE IF NOT EXISTS branch_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    branch VARCHAR(50) NOT NULL,
    academic_year VARCHAR(9) NOT NULL,
    semester TINYINT NOT NULL,
    mid_max INT DEFAULT 20, -- 20 or 25
    assignment_max INT DEFAULT 10, -- 10 or 5
    is_locked TINYINT(1) DEFAULT 0, -- Prevents pattern change after marks entry
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_branch_sem (branch, academic_year, semester)
);

-- 3. Create the Department Timetable table (7-period structure)
CREATE TABLE IF NOT EXISTS branch_timetable (
    id INT AUTO_INCREMENT PRIMARY KEY,
    branch VARCHAR(50) NOT NULL,
    semester TINYINT NOT NULL,
    section VARCHAR(5) DEFAULT 'A',
    day_of_week ENUM('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT') NOT NULL,
    period_number INT NOT NULL, -- 1 to 7
    subject_code VARCHAR(50),
    faculty_id INT, -- Links to clerks table
    academic_year VARCHAR(9) NOT NULL,
    room_no VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (faculty_id) REFERENCES clerks(id) ON DELETE SET NULL,
    UNIQUE KEY unique_slot (branch, semester, section, day_of_week, period_number, academic_year)
);

-- 4. Example: How to promote a Faculty to HOD for CSE
-- UPDATE clerks SET is_hod = 1, branch = 'CSE' WHERE email = 'faculty_email@kucet.edu';

-- 5. Note on Timetable Periods (as per institutional schedule):
-- Period 1: 09:30 - 10:20
-- Period 2: 10:20 - 11:10
-- BREAK: 11:10 - 11:20
-- Period 3: 11:20 - 12:10
-- Period 4: 12:10 - 01:00
-- LUNCH: 01:00 - 02:00
-- Period 5: 02:00 - 02:50
-- Period 6: 02:50 - 03:40
-- Period 7: 03:40 - 04:30

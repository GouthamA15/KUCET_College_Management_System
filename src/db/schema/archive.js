import { 
  mysqlTable, varchar, int, boolean, text, decimal, timestamp, 
  mysqlEnum, tinyint, index, date
} from 'drizzle-orm/mysql-core';

/**
 * Archive Domain Schemas for KUCET College Management System
 * Stores historical student lifecycle, attendance, marks, payments, and operational audit records.
 */

// 1. Archived Student Profile
export const archiveStudents = mysqlTable('archive_students', {
  id: int('id').autoincrement().primaryKey().notNull(),
  original_student_id: int('original_student_id').notNull(),
  roll_no: varchar('roll_no', { length: 20 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  mobile: varchar('mobile', { length: 512 }),
  branch: varchar('branch', { length: 50 }),
  batch: varchar('batch', { length: 20 }),
  admission_year: varchar('admission_year', { length: 9 }),
  graduation_year: varchar('graduation_year', { length: 9 }),
  academic_status: varchar('academic_status', { length: 50 }).default('GRADUATED'),
  student_status: varchar('student_status', { length: 50 }).default('ARCHIVED'),
  fee_reimbursement: varchar('fee_reimbursement', { length: 10 }),
  pfp: text('pfp'),
  archived_at: timestamp('archived_at').defaultNow().notNull(),
  archived_by: varchar('archived_by', { length: 100 }).default('SYSTEM'),
  archive_reason: text('archive_reason'),
}, (table) => ({
  rollNoIdx: index('idx_archive_students_roll_no').on(table.roll_no),
  branchBatchIdx: index('idx_archive_students_branch_batch').on(table.branch, table.batch),
}));

// 2. Archived Student Personal Details
export const archiveStudentPersonalDetails = mysqlTable('archive_student_personal_details', {
  id: int('id').autoincrement().primaryKey().notNull(),
  archive_student_id: int('archive_student_id').notNull(),
  original_detail_id: int('original_detail_id'),
  father_name: varchar('father_name', { length: 255 }),
  mother_name: varchar('mother_name', { length: 255 }),
  dob: date('dob'),
  category: varchar('category', { length: 50 }),
  sub_caste: varchar('sub_caste', { length: 50 }),
  gender: varchar('gender', { length: 20 }),
  aadhaar_no: varchar('aadhaar_no', { length: 512 }),
  guardian_mobile: varchar('guardian_mobile', { length: 512 }),
  permanent_address: text('permanent_address'),
  signature_path: text('signature_path'),
  archived_at: timestamp('archived_at').defaultNow().notNull(),
}, (table) => ({
  archiveStudentIdx: index('idx_archive_personal_student_id').on(table.archive_student_id),
}));

// 3. Archived Student Academic Background
export const archiveStudentAcademicBackground = mysqlTable('archive_student_academic_background', {
  id: int('id').autoincrement().primaryKey().notNull(),
  archive_student_id: int('archive_student_id').notNull(),
  ssc_school: text('ssc_school'),
  ssc_gpa: varchar('ssc_gpa', { length: 10 }),
  inter_college: text('inter_college'),
  inter_gpa: varchar('inter_gpa', { length: 10 }),
  archived_at: timestamp('archived_at').defaultNow().notNull(),
}, (table) => ({
  archiveStudentIdx: index('idx_archive_background_student_id').on(table.archive_student_id),
}));

// 4. Archived Student Attendance Records
export const archiveStudentAttendance = mysqlTable('archive_student_attendance', {
  id: int('id').autoincrement().primaryKey().notNull(),
  original_attendance_id: int('original_attendance_id'),
  student_id: int('student_id').notNull(),
  roll_no: varchar('roll_no', { length: 20 }).notNull(),
  assignment_id: int('assignment_id').notNull(),
  branch: varchar('branch', { length: 50 }).notNull(),
  semester: tinyint('semester').notNull(),
  subject_code: varchar('subject_code', { length: 50 }),
  academic_year: varchar('academic_year', { length: 9 }).notNull(),
  date: date('date').notNull(),
  session: tinyint('session').notNull(),
  status: mysqlEnum('status', ['PRESENT', 'ABSENT', 'EXEMPTED']).default('PRESENT').notNull(),
  marked_by: int('marked_by'),
  verification_mode: varchar('verification_mode', { length: 20 }).default('MANUAL'),
  device_fingerprint: text('device_fingerprint'),
  created_at: timestamp('created_at'),
  archived_at: timestamp('archived_at').defaultNow().notNull(),
}, (table) => ({
  studentRollIdx: index('idx_archive_att_roll').on(table.roll_no),
  branchSemYearIdx: index('idx_archive_att_branch_sem_year').on(table.branch, table.semester, table.academic_year),
  dateIdx: index('idx_archive_att_date').on(table.date),
}));

// 5. Archived Attendance Sessions & Lecture Topics
export const archiveAttendanceSessions = mysqlTable('archive_attendance_sessions', {
  id: int('id').autoincrement().primaryKey().notNull(),
  original_session_id: int('original_session_id'),
  assignment_id: int('assignment_id').notNull(),
  branch: varchar('branch', { length: 50 }).notNull(),
  semester: tinyint('semester').notNull(),
  academic_year: varchar('academic_year', { length: 9 }).notNull(),
  date: date('date').notNull(),
  session: tinyint('session').notNull(),
  faculty_id: int('faculty_id'),
  topic_covered: text('topic_covered'),
  created_at: timestamp('created_at'),
  archived_at: timestamp('archived_at').defaultNow().notNull(),
}, (table) => ({
  assignmentDateIdx: index('idx_archive_sessions_assignment_date').on(table.assignment_id, table.date),
  branchSemYearIdx: index('idx_archive_sessions_lookup').on(table.branch, table.semester, table.academic_year),
}));

// 6. Archived Student Internal Marks
export const archiveStudentMarks = mysqlTable('archive_student_marks', {
  id: int('id').autoincrement().primaryKey().notNull(),
  original_mark_id: int('original_mark_id'),
  student_id: int('student_id').notNull(),
  roll_no: varchar('roll_no', { length: 20 }).notNull(),
  assignment_id: int('assignment_id').notNull(),
  subject_code: varchar('subject_code', { length: 50 }),
  branch: varchar('branch', { length: 50 }),
  semester: tinyint('semester'),
  academic_year: varchar('academic_year', { length: 9 }),
  mid1_marks: decimal('mid1_marks', { precision: 5, scale: 2 }),
  mid2_marks: decimal('mid2_marks', { precision: 5, scale: 2 }),
  assignment_marks: decimal('assignment_marks', { precision: 5, scale: 2 }),
  lab_theory_marks: decimal('lab_theory_marks', { precision: 5, scale: 2 }),
  lab_execution_marks: decimal('lab_execution_marks', { precision: 5, scale: 2 }),
  lab_record_marks: decimal('lab_record_marks', { precision: 5, scale: 2 }),
  is_published: boolean('is_published').default(true),
  created_at: timestamp('created_at'),
  archived_at: timestamp('archived_at').defaultNow().notNull(),
}, (table) => ({
  studentRollIdx: index('idx_archive_marks_roll').on(table.roll_no),
  assignmentIdx: index('idx_archive_marks_assignment').on(table.assignment_id),
}));

// 7. Archived Fee Payments & Financial Records
export const archiveStudentPayments = mysqlTable('archive_student_payments', {
  id: int('id').autoincrement().primaryKey().notNull(),
  original_payment_id: int('original_payment_id'),
  student_id: int('student_id').notNull(),
  roll_no: varchar('roll_no', { length: 20 }).notNull(),
  academic_year: varchar('academic_year', { length: 9 }).notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  transaction_ref_no: varchar('transaction_ref_no', { length: 100 }),
  transaction_date: date('transaction_date'),
  payment_mode: varchar('payment_mode', { length: 50 }),
  bank_name: varchar('bank_name', { length: 100 }),
  proof_url: text('proof_url'),
  status: varchar('status', { length: 50 }).default('VERIFIED'),
  created_at: timestamp('created_at'),
  archived_at: timestamp('archived_at').defaultNow().notNull(),
}, (table) => ({
  studentRollIdx: index('idx_archive_payments_roll').on(table.roll_no),
  refNoIdx: index('idx_archive_payments_ref').on(table.transaction_ref_no),
}));

// 8. Archive Operations Audit Log
export const archiveOperationsLog = mysqlTable('archive_operations_log', {
  id: int('id').autoincrement().primaryKey().notNull(),
  job_id: varchar('job_id', { length: 64 }).notNull(),
  archive_type: mysqlEnum('archive_type', ['SEMESTER', 'ALUMNI', 'MEDIA', 'RESTORE', 'MANUAL']).notNull(),
  branch: varchar('branch', { length: 50 }),
  semester: tinyint('semester'),
  academic_year: varchar('academic_year', { length: 9 }),
  affected_students_count: int('affected_students_count').default(0).notNull(),
  affected_records_count: int('affected_records_count').default(0).notNull(),
  affected_media_count: int('affected_media_count').default(0).notNull(),
  storage_size_bytes: int('storage_size_bytes').default(0).notNull(),
  archived_by: varchar('archived_by', { length: 100 }).notNull(),
  execution_time_ms: int('execution_time_ms').default(0).notNull(),
  status: mysqlEnum('status', ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'RESTORED']).default('COMPLETED').notNull(),
  error_message: text('error_message'),
  details: text('details'),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  jobIdIdx: index('idx_archive_log_job_id').on(table.job_id),
  archiveTypeIdx: index('idx_archive_log_type').on(table.archive_type),
  createdAtIdx: index('idx_archive_log_created').on(table.created_at),
}));

// 9. Configurable Retention Policies
export const archiveRetentionPolicies = mysqlTable('archive_retention_policies', {
  id: int('id').autoincrement().primaryKey().notNull(),
  entity_type: mysqlEnum('entity_type', ['ATTENDANCE', 'MARKS', 'PAYMENT_EVIDENCE', 'GRADUATED_STUDENTS', 'SIGNATURES']).notNull(),
  auto_archive_enabled: boolean('auto_archive_enabled').default(true).notNull(),
  retention_months: int('retention_months').default(6).notNull(),
  description: text('description'),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  updated_by: varchar('updated_by', { length: 100 }).default('SYSTEM'),
});

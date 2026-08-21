import { 
  mysqlTable, varchar, int, boolean, text, decimal, json, timestamp, 
  mysqlEnum, tinyint, index, uniqueIndex, date
} from 'drizzle-orm/mysql-core';

export const studentMarks = mysqlTable('student_marks', {
  id: int('id').autoincrement().primaryKey().notNull(),
  student_id: int('student_id').notNull(),
  assignment_id: int('assignment_id').notNull(),
  is_published: boolean('is_published').default(true).notNull(),
  mid1_marks: decimal('mid1_marks', { precision: 5, scale: 2 }),
  mid2_marks: decimal('mid2_marks', { precision: 5, scale: 2 }),
  assignment_marks: decimal('assignment_marks', { precision: 5, scale: 2 }),
  lab_theory_marks: decimal('lab_theory_marks', { precision: 5, scale: 2 }),
  lab_execution_marks: decimal('lab_execution_marks', { precision: 5, scale: 2 }),
  lab_record_marks: decimal('lab_record_marks', { precision: 5, scale: 2 }),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
  version: int('version').default(1).notNull(),
}, (table) => ({
  studentAssignmentIdx: index('idx_marks_student_assignment').on(table.student_id, table.assignment_id),
  studentAssignmentUniq: uniqueIndex('uq_marks_student_assignment').on(table.student_id, table.assignment_id),
}));

export const branchConfig = mysqlTable('branch_config', {
  id: int('id').autoincrement().primaryKey().notNull(),
  branch: varchar('branch', { length: 50 }).notNull(),
  academic_year: varchar('academic_year', { length: 9 }).notNull(),
  semester: tinyint('semester').notNull(),
  mid_max: int('mid_max').default(20),
  assignment_max: int('assignment_max').default(10),
  is_locked: boolean('is_locked').default(false),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
}, (table) => ({
  lookupIdx: index('idx_bc_lookup').on(table.branch, table.academic_year, table.semester),
}));

export const branchTimetable = mysqlTable('branch_timetable', {
  id: int('id').autoincrement().primaryKey().notNull(),
  branch: varchar('branch', { length: 50 }).notNull(),
  semester: tinyint('semester').notNull(),
  section: varchar('section', { length: 5 }).default('A'),
  day_of_week: mysqlEnum('day_of_week', ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']).notNull(),
  period_number: int('period_number').notNull(),
  subject_code: varchar('subject_code', { length: 50 }),
  faculty_id: int('faculty_id'),
  academic_year: varchar('academic_year', { length: 9 }).notNull(),
  room_no: varchar('room_no', { length: 20 }),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
  version: int('version').default(1).notNull(),
}, (table) => ({
  timetableLookupIdx: index('idx_timetable_lookup').on(table.branch, table.semester, table.academic_year),
  dayPeriodIdx: index('idx_bt_day_period').on(table.day_of_week, table.period_number),
  facultyIdx: index('idx_bt_faculty').on(table.faculty_id),
  uqTimetableSlot: uniqueIndex('uq_timetable_slot').on(table.branch, table.semester, table.section, table.day_of_week, table.period_number, table.academic_year),
}));

export const facultyHodAssignments = mysqlTable('faculty_hod_assignments', {
  id: int('id').autoincrement().primaryKey().notNull(),
  staff_account_id: int('staff_account_id').notNull(),
  department_code: varchar('department_code', { length: 20 }).notNull(),
  academic_year: varchar('academic_year', { length: 9 }).notNull(),
  start_date: date('start_date').notNull(),
  end_date: date('end_date'),
  is_active: boolean('is_active').default(true).notNull(),
  assigned_by: int('assigned_by'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
}, (table) => ({
  staffIdIdx: index('idx_hod_staff_id').on(table.staff_account_id),
  deptIdx: index('idx_hod_dept_code').on(table.department_code),
}));

export const facultySubjectAssignments = mysqlTable('faculty_subject_assignments', {
  id: int('id').autoincrement().primaryKey().notNull(),
  faculty_id: int('faculty_id').notNull(),
  subject_code: varchar('subject_code', { length: 50 }).notNull(),
  subject_name: varchar('subject_name', { length: 255 }).notNull(),
  branch: varchar('branch', { length: 50 }).notNull(),
  course_semester: tinyint('course_semester').notNull(),
  academic_term: tinyint('academic_term').notNull(),
  academic_year: varchar('academic_year', { length: 9 }).notNull(),
  created_at: timestamp('created_at').defaultNow(),
  is_active: boolean('is_active').default(true),
  mid_max: int('mid_max').default(20),
}, (table) => ({
  branchIdx: index('idx_faculty_subject_active').on(table.branch, table.is_active),
  fsaBranchSemIdx: index('idx_fsa_branch_sem').on(table.branch, table.course_semester),
  facultyIdx: index('idx_fsa_faculty').on(table.faculty_id),
  uqFacultySubjectAssignment: uniqueIndex('uq_faculty_subject_assignment').on(table.faculty_id, table.subject_code, table.branch, table.course_semester, table.academic_year, table.is_active),
}));

export const facultySubjectInterests = mysqlTable('faculty_subject_interests', {
  id: int('id').autoincrement().primaryKey().notNull(),
  faculty_id: int('faculty_id').notNull(),
  subject_code: varchar('subject_code', { length: 50 }).notNull(),
  subject_name: varchar('subject_name', { length: 255 }).notNull(),
  branch: varchar('branch', { length: 50 }).notNull(),
  semester: int('semester').notNull(),
  academic_year: varchar('academic_year', { length: 9 }).notNull(),
  status: mysqlEnum('status', ['PENDING', 'APPROVED', 'REJECTED']).default('PENDING').notNull(),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
}, (table) => ({
  facultyIdx: index('idx_fsi_faculty').on(table.faculty_id),
  statusIdx: index('idx_fsi_status').on(table.status),
}));

export const facultySubstitutions = mysqlTable('faculty_substitutions', {
  id: int('id').autoincrement().primaryKey().notNull(),
  original_assignment_id: int('original_assignment_id').notNull(),
  substitute_faculty_id: int('substitute_faculty_id').notNull(),
  substitution_date: date('substitution_date').notNull(),
  created_at: timestamp('created_at').defaultNow(),
  created_by_staff_id: int('created_by_staff_id'),
}, (table) => ({
  lookupIdx: index('idx_subst_lookup').on(table.original_assignment_id, table.substitution_date),
  substituteIdx: index('idx_subst_faculty').on(table.substitute_faculty_id),
}));

export const studentRequests = mysqlTable('student_requests', {
  request_id: int('request_id').autoincrement().primaryKey().notNull(),
  student_id: int('student_id').notNull(),
  certificate_type: varchar('certificate_type', { length: 100 }).notNull(),
  purpose: text('purpose'),
  from_date: date('from_date'),
  to_date: date('to_date'),
  generated_certificate_id: varchar('generated_certificate_id', { length: 50 }),
  academic_year: varchar('academic_year', { length: 9 }).notNull(),
  status: mysqlEnum('status', ['PENDING', 'APPROVED', 'REJECTED']).default('PENDING').notNull(),
  payment_amount: int('payment_amount').notNull(),
  transaction_id: varchar('transaction_id', { length: 100 }),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
  completed_at: timestamp('completed_at'),
  reject_reason: text('reject_reason'),
  generated_attendance: varchar('generated_attendance', { length: 10 }),
  action_by_staff_id: int('action_by_staff_id'),
  action_by_role: varchar('action_by_role', { length: 50 }),
  is_flagged: boolean('is_flagged').default(false),
  flag_details: json('flag_details'),
  payment_hash: varchar('payment_hash', { length: 64 }),
}, (table) => ({
  genCertIdx: index('idx_gen_cert_id').on(table.generated_certificate_id),
  studentIdx: index('idx_sr_student').on(table.student_id),
  statusIdx: index('idx_sr_status').on(table.status),
  hashIdx: index('idx_sr_payment_hash').on(table.payment_hash),
  transIdx: index('idx_sr_transaction').on(table.transaction_id),
}));

export const studentRequestImages = mysqlTable('student_request_images', {
  request_id: int('request_id').notNull().primaryKey(),
  payment_screenshot: text('payment_screenshot'),
}, (table) => ({
  requestIdx: index('idx_sri_request').on(table.request_id),
}));

export const certificateVerifications = mysqlTable('certificate_verifications', {
  id: int('id').autoincrement().primaryKey().notNull(),
  request_id: int('request_id').notNull(),
  verification_date: timestamp('verification_date').defaultNow(),
  ip_address: varchar('ip_address', { length: 45 }),
  user_agent: text('user_agent'),
  device_name: varchar('device_name', { length: 255 }),
  location_name: varchar('location_name', { length: 255 }),
  latitude: decimal('latitude', { precision: 10, scale: 8 }),
  longitude: decimal('longitude', { precision: 11, scale: 8 }),
}, (table) => ({
  requestIdx: index('idx_cv_request').on(table.request_id),
}));

export const certificateVerificationsArchive = mysqlTable('certificate_verifications_archive', {
  id: int('id').primaryKey().notNull(),
  request_id: int('request_id').notNull(),
  verification_date: timestamp('verification_date').notNull(),
  ip_address: varchar('ip_address', { length: 45 }),
  user_agent: text('user_agent'),
  device_name: varchar('device_name', { length: 255 }),
  location_name: varchar('location_name', { length: 255 }),
  latitude: decimal('latitude', { precision: 10, scale: 8 }),
  longitude: decimal('longitude', { precision: 11, scale: 8 }),
  archived_at: timestamp('archived_at').defaultNow(),
}, (table) => ({
  requestIdx: index('idx_cv_archive_request').on(table.request_id),
  dateIdx: index('idx_cv_archive_date').on(table.verification_date),
}));

export const bugReports = mysqlTable('bug_reports', {
  id: int('id').autoincrement().primaryKey().notNull(),
  description: text('description').notNull(),
  screenshot_url: text('screenshot_url'),
  type: mysqlEnum('type', ['BUG', 'FEATURE_REQUEST']).default('BUG').notNull(),
  status: mysqlEnum('status', ['OPEN', 'RESOLVED', 'CLOSED']).default('OPEN').notNull(),
  severity: mysqlEnum('severity', ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).default('MEDIUM').notNull(),
  submitted_by: varchar('submitted_by', { length: 255 }).notNull(),
  user_type: mysqlEnum('user_type', ['student', 'staff', 'admin']).notNull(),
  affected_page: varchar('affected_page', { length: 255 }),
  browser_info: text('browser_info'),
  fixed_by: varchar('fixed_by', { length: 255 }),
  fixed_at: timestamp('fixed_at'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
}, (table) => ({
  statusIdx: index('idx_bug_status').on(table.status),
  severityIdx: index('idx_bug_severity').on(table.severity),
  submittedByIdx: index('idx_bug_submitted_by').on(table.submitted_by),
  typeIdx: index('idx_bug_type').on(table.type),
  createdAtIdx: index('idx_bug_created_at').on(table.created_at),
}));


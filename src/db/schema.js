import { 
  mysqlTable, varchar, int, boolean, text, decimal, json, timestamp, 
  mysqlEnum, tinyint, float, bigint, index, uniqueIndex, date
} from 'drizzle-orm/mysql-core';

// --- 1. COLLEGE CONFIGURATION ---

export const systemConfigs = mysqlTable('system_configs', {
  config_key: varchar('config_key', { length: 100 }).primaryKey().notNull(),
  config_value: text('config_value').notNull(),
  data_type: mysqlEnum('data_type', ['STRING', 'NUMBER', 'BOOLEAN', 'JSON']).default('STRING').notNull(),
  description: text('description'),
  updated_at: timestamp('updated_at').onUpdateNow(),
  updated_by: varchar('updated_by', { length: 255 }),
});

export const collegeInfo = mysqlTable('college_info', {
  id: int('id').autoincrement().primaryKey().notNull(),
  name: varchar('name', { length: 255 }).default('KU COLLEGE OF ENGINEERING & TECHNOLOGY'),
  short_name: varchar('short_name', { length: 50 }).default('KUCET'),
  address: text('address'),
  location: varchar('location', { length: 100 }).default('Warangal'),
  pincode: varchar('pincode', { length: 10 }).default('506009'),
  contact: varchar('contact', { length: 100 }).default('0870-2970125'),
  entrance_codes: json('entrance_codes'), // stores { tgpgecet, tgeapcet, tgecet }
  branches: json('branches'), // stores array of { code, name }
  categories: json('categories'), // array of strings
  annual_incomes: json('annual_incomes'), // array of strings
  first_sem_start_month: tinyint('first_sem_start_month'),
  first_sem_start_day: tinyint('first_sem_start_day'),
  second_sem_start_month: tinyint('second_sem_start_month'),
  second_sem_start_day: tinyint('second_sem_start_day'),
  maintenance_mode: boolean('maintenance_mode').default(false).notNull(),
  updated_at: timestamp('updated_at').onUpdateNow(),
});

// --- 2. CORE IDENTITY & AUTHENTICATION ---

export const students = mysqlTable('students', {
  id: int('id').autoincrement().primaryKey().notNull(),
  admission_no: varchar('admission_no', { length: 255 }),
  roll_no: varchar('roll_no', { length: 255 }),
  fee_reimbursement: mysqlEnum('fee_reimbursement', ['YES', 'NO']).default('NO').notNull(),
  name: varchar('name', { length: 255 }),
  date_of_birth: date('date_of_birth'),
  gender: varchar('gender', { length: 50 }),
  mobile: varchar('mobile', { length: 255 }), // Encrypted
  mobile_hash: varchar('mobile_hash', { length: 64 }), // Searchable Blind Index
  email: varchar('email', { length: 255 }),
  created_at: timestamp('created_at').defaultNow(),
  is_email_verified: boolean('is_email_verified').default(false).notNull(),
  email_verified_at: timestamp('email_verified_at'),
  password_hash: varchar('password_hash', { length: 255 }),
  admission_date: date('admission_date'),
  added_by_clerk_id: int('added_by_clerk_id'),
  updated_at: timestamp('updated_at').onUpdateNow(),
  updated_by_clerk_id: int('updated_by_clerk_id'),
  student_status: mysqlEnum('student_status', ['ACTIVE', 'DISCONTINUED']).default('ACTIVE'),
  academic_status: mysqlEnum('academic_status', ['ACTIVE', 'GRADUATED', 'DETAINED', 'SUSPENDED']).default('ACTIVE'),
  academic_offset_years: int('academic_offset_years').default(0),
  last_login_at: timestamp('last_login_at'),
  last_login_ip: varchar('last_login_ip', { length: 64 }),
  password_changed_at: timestamp('password_changed_at'),
}, (table) => ({
  rollNoIdx: index('idx_roll_no').on(table.roll_no),
  rollNoUniq: uniqueIndex('uq_students_roll_no').on(table.roll_no),
  mobileHashIdx: index('idx_students_mobile_hash').on(table.mobile_hash),
  emailIdx: index('idx_students_email').on(table.email),
  createdAtIdx: index('idx_students_created_at').on(table.created_at),
}));

export const clerks = mysqlTable('clerks', {
  id: int('id').autoincrement().primaryKey().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  employee_id: varchar('employee_id', { length: 255 }),
  password_hash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).default('scholarship').notNull(),
  mobile: varchar('mobile', { length: 255 }), // Encrypted
  mobile_hash: varchar('mobile_hash', { length: 64 }), // Searchable Blind Index
  pfp: text('pfp'),
  signature: text('signature'),
  address: text('address'),
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
  is_hod: boolean('is_hod').default(false),
  branch: varchar('branch', { length: 50 }),
  last_login_at: timestamp('last_login_at'),
  last_login_ip: varchar('last_login_ip', { length: 64 }),
  password_changed_at: timestamp('password_changed_at'),
}, (table) => ({
  emailIdx: index('idx_clerks_email').on(table.email),
  employeeIdIdx: index('idx_clerks_employee_id').on(table.employee_id),
}));

export const principal = mysqlTable('principal', {
  id: int('id').autoincrement().primaryKey().notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  password_hash: varchar('password_hash', { length: 255 }).notNull(),
  last_login_at: timestamp('last_login_at'),
  last_login_ip: varchar('last_login_ip', { length: 64 }),
  password_changed_at: timestamp('password_changed_at'),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  emailIdx: index('idx_principal_email').on(table.email),
}));

// --- 2. STUDENT PERSONAL & ACADEMIC RECORDS ---

export const studentPersonalDetails = mysqlTable('student_personal_details', {
  id: int('id').autoincrement().primaryKey().notNull(),
  student_id: int('student_id').notNull(),
  father_name: varchar('father_name', { length: 255 }),
  mother_name: varchar('mother_name', { length: 255 }),
  nationality: varchar('nationality', { length: 100 }),
  religion: varchar('religion', { length: 100 }),
  category: varchar('category', { length: 50 }),
  sub_caste: varchar('sub_caste', { length: 100 }),
  area_status: mysqlEnum('area_status', ['Local', 'Non-Local']),
  mother_tongue: varchar('mother_tongue', { length: 100 }),
  place_of_birth: varchar('place_of_birth', { length: 255 }),
  father_occupation: varchar('father_occupation', { length: 255 }),
  guardian_mobile: varchar('guardian_mobile', { length: 255 }), // Encrypted
  annual_income: varchar('annual_income', { length: 50 }),
  aadhaar_no: varchar('aadhaar_no', { length: 255 }), // Encrypted
  aadhaar_hash: varchar('aadhaar_hash', { length: 64 }), // Searchable Blind Index
  // Structured Address (Permanent)
  perm_house_no: varchar('perm_house_no', { length: 255 }),
  perm_street: varchar('perm_street', { length: 255 }),
  perm_apartment: varchar('perm_apartment', { length: 255 }),
  perm_city: varchar('perm_city', { length: 255 }),
  perm_state: varchar('perm_state', { length: 255 }),
  perm_pincode: varchar('perm_pincode', { length: 20 }),
  perm_country: varchar('perm_country', { length: 100 }).default('India'),

  // Structured Address (Current)
  curr_house_no: varchar('curr_house_no', { length: 255 }),
  curr_street: varchar('curr_street', { length: 255 }),
  curr_apartment: varchar('curr_apartment', { length: 255 }),
  curr_city: varchar('curr_city', { length: 255 }),
  curr_state: varchar('curr_state', { length: 255 }),
  curr_pincode: varchar('curr_pincode', { length: 20 }),
  curr_country: varchar('curr_country', { length: 100 }).default('India'),

  is_current_same_as_permanent: boolean('is_current_same_as_permanent').default(false),
  
  seat_allotted_category: varchar('seat_allotted_category', { length: 100 }),
  identification_marks: text('identification_marks'),
  blood_group: mysqlEnum('blood_group', ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
}, (table) => ({
  studentIdIdx: index('idx_spd_student_id').on(table.student_id),
  aadhaarHashIdx: index('idx_spd_aadhaar_hash').on(table.aadhaar_hash),
}));

export const studentAcademicBackground = mysqlTable('student_academic_background', {
  id: int('id').autoincrement().primaryKey().notNull(),
  student_id: int('student_id').notNull(),
  qualifying_exam: varchar('qualifying_exam', { length: 50 }),
  previous_college_details: text('previous_college_details'),
  medium_of_instruction: varchar('medium_of_instruction', { length: 50 }),
  ranks: int('ranks'),
  ssc_marks: varchar('ssc_marks', { length: 50 }),
  inter_marks: varchar('inter_marks', { length: 50 }),
}, (table) => ({
  studentIdIdx: index('idx_sab_student_id').on(table.student_id),
}));

export const studentAdmissionDrafts = mysqlTable('student_admission_drafts', {
  id: int('id').autoincrement().primaryKey().notNull(),
  status: mysqlEnum('status', ['DRAFT', 'PROCESSED', 'FINALIZED']).default('DRAFT').notNull(),
  admission_year: varchar('admission_year', { length: 9 }).notNull(),
  entrance_exam: varchar('entrance_exam', { length: 10 }).notNull(),
  branch: varchar('branch', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  father_name: varchar('father_name', { length: 255 }),
  mother_name: varchar('mother_name', { length: 255 }),
  dob: date('dob'),
  gender: varchar('gender', { length: 10 }),
  email: varchar('email', { length: 255 }),
  student_mobile: varchar('student_mobile', { length: 255 }), // Encrypted
  mobile_hash: varchar('mobile_hash', { length: 64 }), // Searchable Index
  guardian_mobile: varchar('guardian_mobile', { length: 255 }), // Encrypted
  pfp: text('pfp'),
  signature: text('signature'),
  exam_rank: int('exam_rank'),
  area_status: varchar('area_status', { length: 50 }),
  category: varchar('category', { length: 50 }),
  sub_caste: varchar('sub_caste', { length: 100 }),
  seat_allotted_category: varchar('seat_allotted_category', { length: 100 }),
  ssc_marks: varchar('ssc_marks', { length: 50 }),
  inter_diploma_marks: varchar('inter_diploma_marks', { length: 50 }),
  nationality: varchar('nationality', { length: 100 }),
  religion: varchar('religion', { length: 100 }),
  mother_tongue: varchar('mother_tongue', { length: 100 }),
  blood_group: varchar('blood_group', { length: 10 }),
  place_of_birth: varchar('place_of_birth', { length: 255 }),
  father_occupation: varchar('father_occupation', { length: 255 }),
  annual_income: varchar('annual_income', { length: 50 }),
  aadhaar_no: varchar('aadhaar_no', { length: 255 }), // Encrypted
  aadhaar_hash: varchar('aadhaar_hash', { length: 64 }), // Searchable Index
  fee_reimbursement: mysqlEnum('fee_reimbursement', ['YES', 'NO', 'GOV']),
  identification_mark_1: text('identification_mark_1'),
  identification_mark_2: text('identification_mark_2'),
  
  // Structured Address (Permanent)
  perm_house_no: varchar('perm_house_no', { length: 255 }),
  perm_street: varchar('perm_street', { length: 255 }),
  perm_apartment: varchar('perm_apartment', { length: 255 }),
  perm_city: varchar('perm_city', { length: 255 }),
  perm_state: varchar('perm_state', { length: 255 }),
  perm_pincode: varchar('perm_pincode', { length: 20 }),
  perm_country: varchar('perm_country', { length: 100 }).default('India'),

  // Structured Address (Current)
  curr_house_no: varchar('curr_house_no', { length: 255 }),
  curr_street: varchar('curr_street', { length: 255 }),
  curr_apartment: varchar('curr_apartment', { length: 255 }),
  curr_city: varchar('curr_city', { length: 255 }),
  curr_state: varchar('curr_state', { length: 255 }),
  curr_pincode: varchar('curr_pincode', { length: 20 }),
  curr_country: varchar('curr_country', { length: 100 }).default('India'),

  is_current_same_as_permanent: boolean('is_current_same_as_permanent').default(false),

  admission_date: date('admission_date'),
  roll_no: varchar('roll_no', { length: 255 }), // Promised/Assigned Roll Number
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
}, (table) => ({
  emailIdx: index('idx_draft_email').on(table.email),
  mobileHashIdx: index('idx_draft_mobile_hash').on(table.mobile_hash),
  aadhaarHashIdx: index('idx_draft_aadhaar_hash').on(table.aadhaar_hash),
  statusIdx: index('idx_draft_status').on(table.status),
}));

export const academicCalendar = mysqlTable('academic_calendar', {
  id: int('id').autoincrement().primaryKey().notNull(),
  date: date('date').notNull(),
  academic_year: varchar('academic_year', { length: 9 }).notNull(),
  semester: tinyint('semester').notNull(),
  holiday_name: varchar('holiday_name', { length: 255 }),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
  day_type: mysqlEnum('day_type', ['WORKING', 'HOLIDAY', 'EXAM', 'INTERNAL', 'EVENT']).default('WORKING').notNull(),
}, (table) => ({
  dateIdx: index('idx_date').on(table.date),
  aySemIdx: index('idx_ay_sem').on(table.academic_year, table.semester),
  uqDate: uniqueIndex('uq_academic_calendar_date').on(table.date),
}));


export const studentAttendance = mysqlTable('student_attendance', {
  id: int('id').autoincrement().primaryKey().notNull(),
  student_id: int('student_id').notNull(),
  assignment_id: int('assignment_id').notNull(),
  date: date('date').notNull(),
  session: int('session').notNull(),
  status: mysqlEnum('status', ['PRESENT', 'ABSENT', 'NCC', 'MEDICAL']).notNull(),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  attendanceIdx: index('idx_attendance_lookup').on(table.assignment_id, table.date, table.session),
  historyIdx: index('idx_student_attendance_history').on(table.student_id, table.date),
  studentAssignmentIdx: index('idx_sa_student_assignment').on(table.student_id, table.assignment_id),
  uqAttendance: uniqueIndex('uq_student_attendance').on(table.student_id, table.assignment_id, table.date, table.session),
}));

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

// --- 4. DEPARTMENTAL & SCHEDULING ---

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
  uqTimetableSlot: uniqueIndex('uq_timetable_slot').on(table.branch, table.semester, table.section, table.day_of_week, table.period_number, table.academic_year),
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
}));

// --- 5. SYLLABUS & CURRICULUM ---

export const syllabusSubjects = mysqlTable('syllabus_subjects', {
  subject_code: varchar('subject_code', { length: 50 }).notNull().primaryKey(),
  subject_name: varchar('subject_name', { length: 255 }).notNull(),
  subject_type: mysqlEnum('subject_type', ['theory', 'lab']).notNull(),
});

export const syllabusStructure = mysqlTable('syllabus_structure', {
  id: int('id').autoincrement().primaryKey().notNull(),
  branch: varchar('branch', { length: 50 }).notNull(),
  semester: tinyint('semester').notNull(),
  subject_code: varchar('subject_code', { length: 50 }).notNull(),
  is_group: boolean('is_group').default(false),
  parent_group_code: varchar('parent_group_code', { length: 50 }),
}, (table) => ({
  branchIdx: index('branch').on(table.branch, table.semester),
  subjectCodeIdx: index('subject_code').on(table.subject_code),
}));

// --- 6. ASSETS & SIGNATURES ---

export const studentImages = mysqlTable('student_images', {
  student_id: int('student_id').notNull().primaryKey(),
  pfp: text('pfp'),
}, (table) => ({
  studentIdx: index('idx_si_student').on(table.student_id),
}));

export const studentSignatures = mysqlTable('student_signatures', {
  student_id: int('student_id').notNull().primaryKey(),
  signature: text('signature'),
  updated_at: timestamp('updated_at').onUpdateNow(),
}, (table) => ({
  studentIdx: index('idx_ss_student').on(table.student_id),
}));

// --- 7. REQUESTS & CERTIFICATES ---

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
  payment_screenshot: text('payment_screenshot'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
  completed_at: timestamp('completed_at'),
  reject_reason: text('reject_reason'),
  generated_attendance: varchar('generated_attendance', { length: 10 }),
  action_by_clerk_id: int('action_by_clerk_id'),
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
  id: int('id').primaryKey().notNull(), // No autoincrement here to preserve original IDs
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

// --- 8. SECURITY & UTILITY ---

export const otpCodes = mysqlTable('otp_codes', {
  id: int('id').autoincrement().primaryKey().notNull(),
  identifier: varchar('identifier', { length: 255 }).notNull(),
  otp_code: varchar('otp_code', { length: 6 }).notNull(),
  created_at: timestamp('created_at').defaultNow(),
  expires_at: timestamp('expires_at').notNull(),
}, (table) => ({
  identifierIdx: index('idx_otp_identifier').on(table.identifier),
}));

export const passwordResetTokens = mysqlTable('password_reset_tokens', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey().notNull(),
  token_hash: varchar('token_hash', { length: 255 }).notNull(),
  user_id: varchar('user_id', { length: 255 }).notNull(),
  user_type: mysqlEnum('user_type', ['student', 'clerk', 'admin']).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  expires_at: timestamp('expires_at').notNull(),
  used_at: timestamp('used_at'),
}, (table) => ({
  userTypeIdx: index('idx_password_reset_user').on(table.user_id, table.user_type),
  expiryIdx: index('idx_password_reset_expiry').on(table.expires_at),
}));

export const rateLimits = mysqlTable('rate_limits', {
  key_name: varchar('key_name', { length: 255 }).notNull().primaryKey(),
  points: int('points').default(0),
  expire_at: timestamp('expire_at').notNull(),
}, (table) => ({
  expireIdx: index('idx_expire').on(table.expire_at),
}));

export const securityEvents = mysqlTable('security_events', {
  id: bigint('id', { mode: 'number' }).autoincrement().primaryKey().notNull(),
  user_type: mysqlEnum('user_type', ['STUDENT', 'CLERK', 'FACULTY', 'HOD', 'ADMIN']).notNull(),
  user_id: bigint('user_id', { mode: 'number', unsigned: true }),
  event_type: varchar('event_type', { length: 50 }),
  ip_address: varchar('ip_address', { length: 64 }),
  details: json('details'),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  userIdx: index('idx_security_events_user').on(table.user_id, table.user_type),
  createdAtIdx: index('idx_security_events_created_at').on(table.created_at),
}));

export const securityNotifications = mysqlTable('security_notifications', {
  id: bigint('id', { mode: 'number' }).autoincrement().primaryKey().notNull(),
  user_type: mysqlEnum('user_type', ['STUDENT', 'CLERK', 'FACULTY', 'HOD', 'ADMIN']).notNull(),
  user_id: bigint('user_id', { mode: 'number', unsigned: true }),
  title: varchar('title', { length: 255 }),
  message: text('message'),
  severity: mysqlEnum('severity', ['INFO', 'WARNING', 'CRITICAL']).default('INFO'),
  is_read: boolean('is_read').default(false),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  userIdx: index('idx_security_notifications_user').on(table.user_id, table.user_type),
  severityIdx: index('idx_security_notifications_severity').on(table.severity),
  createdAtIdx: index('idx_security_notifications_created_at').on(table.created_at),
}));

// --- 9. SCHOLARSHIP & FINANCE ---

export const scholarshipSanctions = mysqlTable('scholarship_sanctions', {
  id: int('id').autoincrement().primaryKey().notNull(),
  student_id: int('student_id').notNull(),
  academic_year: varchar('academic_year', { length: 9 }).notNull(),
  application_no: varchar('application_no', { length: 255 }).notNull(),
  proceeding_no: varchar('proceeding_no', { length: 255 }),
  sanctioned_amount: decimal('sanctioned_amount', { precision: 10, scale: 2 }),
  sanction_date: date('sanction_date'),
  released_amount: decimal('released_amount', { precision: 10, scale: 2 }),
  released_date: date('released_date'),
  status: mysqlEnum('status', ['PENDING', 'SANCTIONED', 'RELEASED', 'REJECTED']).default('PENDING'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
  thumb_update_available: boolean('thumb_update_available').default(false),
  thumb_status: mysqlEnum('thumb_status', ['PENDING', 'COMPLETED', 'FAILED']).default('PENDING'),
  hardcopy_submitted: tinyint('hardcopy_submitted').default(0),
  version: int('version').default(1).notNull(),
}, (table) => ({
  appYearIdx: index('idx_scholarship_app_year').on(table.application_no, table.academic_year),
  searchIdx: index('idx_scholarship_search').on(table.student_id, table.academic_year),
}));

export const scholarshipWindows = mysqlTable('scholarship_windows', {
  id: int('id').autoincrement().primaryKey().notNull(),
  academic_year: varchar('academic_year', { length: 9 }),
  start_date: date('start_date'),
  end_date: date('end_date'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
});

export const studentFeePayments = mysqlTable('student_fee_payments', {
  id: int('id').autoincrement().primaryKey().notNull(),
  student_id: int('student_id').notNull(),
  academic_year: varchar('academic_year', { length: 9 }).notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  transaction_ref_no: varchar('transaction_ref_no', { length: 255 }).notNull(),
  transaction_date: date('transaction_date').notNull(),
  payment_mode: varchar('payment_mode', { length: 50 }),
  bank_name: varchar('bank_name', { length: 255 }),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  studentIdx: index('idx_sfp_student').on(table.student_id),
}));

// --- 10. REAL-TIME & SESSIONS ---

export const attendanceSessions = mysqlTable('attendance_sessions', {
  id: int('id').autoincrement().primaryKey().notNull(),
  assignment_id: int('assignment_id').notNull(),
  attendance_date: date('attendance_date'),
  faculty_id: int('faculty_id').notNull(),
  session_pin: varchar('session_pin', { length: 4 }).notNull(),
  session_token: varchar('session_token', { length: 64 }).notNull(),
  latitude: decimal('latitude', { precision: 10, scale: 8 }),
  longitude: decimal('longitude', { precision: 11, scale: 8 }),
  is_active: boolean('is_active').default(true),
  expires_at: timestamp('expires_at').notNull(),
  created_at: timestamp('created_at').defaultNow(),
  session_number: int('session_number').default(1),
  accuracy: float('accuracy'),
}, (table) => ({
  assignmentActiveIdx: index('idx_assignment_active').on(table.assignment_id, table.is_active),
  sessionsActiveIdx: index('idx_sessions_active').on(table.is_active, table.expires_at),
  tokenIdx: index('idx_session_token').on(table.session_token),
}));

export const idempotencyKeys = mysqlTable('idempotency_keys', {
  id: bigint('id', { mode: 'number' }).autoincrement().primaryKey().notNull(),
  idempotency_key: varchar('idempotency_key', { length: 255 }).notNull(),
  status: mysqlEnum('status', ['STARTED', 'COMPLETED', 'FAILED']).default('STARTED').notNull(),
  response_code: int('response_code'),
  response_body: json('response_body'),
  created_at: timestamp('created_at').defaultNow(),
  expires_at: timestamp('expires_at').notNull(),
}, (table) => ({
  keyIdx: uniqueIndex('uq_idempotency_key').on(table.idempotency_key),
  expiryIdx: index('idx_idempotency_expiry').on(table.expires_at),
}));

export const attendanceSessionLogs = mysqlTable('attendance_session_logs', {
  id: int('id').autoincrement().primaryKey().notNull(),
  session_id: int('session_id').notNull(),
  student_id: int('student_id').notNull(),
  device_hash: varchar('device_hash', { length: 255 }),
  ip_address: varchar('ip_address', { length: 45 }),
  ua_hash: varchar('ua_hash', { length: 32 }),
  status: mysqlEnum('status', ['SUCCESS', 'FAILED_LOCATION', 'FAILED_EXPIRED', 'FAILED_PIN', 'LOCKED']).default('SUCCESS'),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  sessionIpUaIdx: index('idx_session_ip_ua').on(table.session_id, table.ip_address, table.ua_hash),
  studentSessionIdx: index('idx_asl_student_session').on(table.student_id, table.session_id),
}));

// --- 11. SEMESTER MANAGEMENT ---

export const semesters = mysqlTable('semesters', {
  id: int('id').autoincrement().primaryKey().notNull(),
  academic_year: varchar('academic_year', { length: 9 }).notNull(),
  semester: tinyint('semester').notNull(),
  start_date: date('start_date').notNull(),
  end_date: date('end_date').notNull(),
  weekend_pattern: json('weekend_pattern').notNull(),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
});

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
  created_by_clerk_id: int('created_by_clerk_id'),
}, (table) => ({
  lookupIdx: index('idx_subst_lookup').on(table.original_assignment_id, table.substitution_date),
  substituteIdx: index('idx_subst_faculty').on(table.substitute_faculty_id),
}));

export const studentProfileRequests = mysqlTable('student_profile_requests', {
  id: int('id').autoincrement().primaryKey().notNull(),
  student_id: int('student_id').notNull(),
  new_signature: text('new_signature'),
  new_pfp: text('new_pfp'),
  new_data: json('new_data'),
  proof_url: text('proof_url'),
  status: mysqlEnum('status', ['pending', 'approved', 'rejected']).default('pending'),
  rejection_reason: text('rejection_reason'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
}, (table) => ({
  studentIdx: index('idx_spr_student').on(table.student_id),
  statusIdx: index('idx_spr_status').on(table.status),
}));

export const studentImportLogs = mysqlTable('student_import_logs', {
  id: int('id').autoincrement().primaryKey().notNull(),
  clerk_id: int('clerk_id').notNull(),
  total_records: int('total_records').notNull(),
  file_name: varchar('file_name', { length: 255 }),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  importCreatedAtIdx: index('idx_import_created_at').on(table.created_at),
}));

export const auditLogs = mysqlTable('audit_logs', {
  id: int('id').autoincrement().primaryKey().notNull(),
  user_id: int('user_id'), // ID of the Admin or Clerk
  user_type: mysqlEnum('user_type', ['admin', 'clerk', 'student', 'system']).notNull(),
  action: varchar('action', { length: 100 }).notNull(), // e.g., 'UPDATE_MARKS', 'APPROVE_CERTIFICATE'
  target_id: varchar('target_id', { length: 255 }), // ID of the entity being modified
  target_type: varchar('target_type', { length: 100 }), // e.g., 'student', 'marks', 'certificate'
  payload_before: json('payload_before'),
  payload_after: json('payload_after'),
  ip_address: varchar('ip_address', { length: 45 }),
  user_agent: text('user_agent'),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  actionIdx: index('idx_audit_action').on(table.action),
  user_idx: index('idx_audit_user').on(table.user_id, table.user_type),
  targetIdx: index('idx_audit_target').on(table.target_id, table.target_type),
}));

export const refreshTokens = mysqlTable('refresh_tokens', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey().notNull(),
  token_hash: varchar('token_hash', { length: 255 }).notNull(),
  user_id: varchar('user_id', { length: 255 }).notNull(), // roll_no for student, email for clerk/admin
  user_type: mysqlEnum('user_type', ['student', 'clerk', 'admin']).notNull(),
  expires_at: timestamp('expires_at').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  revoked_at: timestamp('revoked_at'),
  replaced_by_token_id: bigint('replaced_by_token_id', { mode: 'number', unsigned: true }),
}, (table) => ({
  tokenHashIdx: index('idx_refresh_token_hash').on(table.token_hash),
  userIdIdx: index('idx_refresh_user').on(table.user_id, table.user_type),
}));

export const userSessions = mysqlTable('user_sessions', {
  id: bigint('id', { mode: 'number' }).autoincrement().primaryKey().notNull(),
  user_type: mysqlEnum('user_type', ['STUDENT', 'CLERK', 'FACULTY', 'HOD', 'ADMIN']),
  user_id: bigint('user_id', { mode: 'number', unsigned: true }),
  session_token_hash: varchar('session_token_hash', { length: 255 }),
  device_name: varchar('device_name', { length: 255 }),
  browser: varchar('browser', { length: 100 }),
  operating_system: varchar('operating_system', { length: 100 }),
  ip_address: varchar('ip_address', { length: 64 }),
  location: varchar('location', { length: 255 }),
  is_current: boolean('is_current').default(false),
  is_revoked: boolean('is_revoked').default(false),
  last_seen_at: timestamp('last_seen_at'),
  created_at: timestamp('created_at').defaultNow(),
  expires_at: timestamp('expires_at'),
}, (table) => ({
  sessionTokenIdx: index('idx_user_session_token').on(table.session_token_hash),
  userIdx: index('idx_user_sessions_user').on(table.user_id, table.user_type),
  lastSeenIdx: index('idx_user_sessions_last_seen').on(table.last_seen_at),
}));

export const bugReports = mysqlTable('bug_reports', {
  id: int('id').autoincrement().primaryKey().notNull(),
  description: text('description').notNull(),
  screenshot_url: text('screenshot_url'),
  type: mysqlEnum('type', ['BUG', 'FEATURE_REQUEST']).default('BUG').notNull(),
  status: mysqlEnum('status', ['OPEN', 'RESOLVED', 'CLOSED']).default('OPEN').notNull(),
  severity: mysqlEnum('severity', ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).default('MEDIUM').notNull(),
  submitted_by: varchar('submitted_by', { length: 255 }).notNull(),
  user_type: mysqlEnum('user_type', ['student', 'clerk', 'admin']).notNull(),
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

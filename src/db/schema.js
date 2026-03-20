import { 
  mysqlTable, varchar, int, boolean, datetime, text, decimal, json, timestamp, 
  mysqlEnum, tinyint, float, bigint, index, date
} from 'drizzle-orm/mysql-core';

// --- 1. COLLEGE CONFIGURATION ---

export const collegeInfo = mysqlTable('college_info', {
  id: int('id').autoincrement().notNull(),
  first_sem_start_month: tinyint('first_sem_start_month'),
  first_sem_start_day: tinyint('first_sem_start_day'),
  second_sem_start_month: tinyint('second_sem_start_month'),
  second_sem_start_day: tinyint('second_sem_start_day'),
  updated_at: datetime('updated_at'),
});

// --- 2. CORE IDENTITY & AUTHENTICATION ---

export const students = mysqlTable('students', {
  id: int('id').autoincrement().notNull(),
  admission_no: varchar('admission_no', { length: 255 }),
  roll_no: varchar('roll_no', { length: 255 }),
  fee_reimbursement: mysqlEnum('fee_reimbursement', ['YES', 'NO']).default('NO').notNull(),
  name: varchar('name', { length: 255 }),
  date_of_birth: date('date_of_birth'),
  gender: varchar('gender', { length: 50 }),
  mobile: varchar('mobile', { length: 20 }),
  email: varchar('email', { length: 255 }),
  created_at: timestamp('created_at').defaultNow(),
  is_email_verified: boolean('is_email_verified').default(false).notNull(),
  email_verified_at: timestamp('email_verified_at'),
  password_hash: varchar('password_hash', { length: 255 }),
  added_by_clerk_id: int('added_by_clerk_id'),
  updated_at: timestamp('updated_at').onUpdateNow(),
  updated_by_clerk_id: int('updated_by_clerk_id'),
  student_status: mysqlEnum('student_status', ['ACTIVE', 'DISCONTINUED']).default('ACTIVE'),
}, (table) => ({
  rollNoIdx: index('idx_roll_no').on(table.roll_no),
  createdAtIdx: index('idx_students_created_at').on(table.created_at),
  updatedAtIdx: index('idx_students_updated_at').on(table.updated_at),
}));

export const clerks = mysqlTable('clerks', {
  id: int('id').autoincrement().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  employee_id: varchar('employee_id', { length: 255 }),
  password_hash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).default('scholarship').notNull(),
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
  is_hod: boolean('is_hod').default(false),
  branch: varchar('branch', { length: 50 }),
});

export const principal = mysqlTable('principal', {
  id: int('id').autoincrement().notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  password_hash: varchar('password_hash', { length: 255 }).notNull(),
  created_at: timestamp('created_at').defaultNow(),
});

// --- 2. STUDENT PERSONAL & ACADEMIC RECORDS ---

export const studentPersonalDetails = mysqlTable('student_personal_details', {
  id: int('id').autoincrement().notNull(),
  student_id: int('student_id'),
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
  guardian_mobile: varchar('guardian_mobile', { length: 20 }),
  annual_income: int('annual_income'),
  aadhaar_no: varchar('aadhaar_no', { length: 12 }),
  address: text('address'),
  seat_allotted_category: varchar('seat_allotted_category', { length: 100 }),
  identification_marks: text('identification_marks'),
  blood_group: mysqlEnum('blood_group', ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
});

export const studentAcademicBackground = mysqlTable('student_academic_background', {
  id: int('id').autoincrement().notNull(),
  student_id: int('student_id'),
  qualifying_exam: varchar('qualifying_exam', { length: 50 }),
  previous_college_details: text('previous_college_details'),
  medium_of_instruction: varchar('medium_of_instruction', { length: 50 }),
  ranks: int('ranks'),
  ssc_marks: varchar('ssc_marks', { length: 50 }),
  inter_marks: varchar('inter_marks', { length: 50 }),
});

export const studentAdmissionDrafts = mysqlTable('student_admission_drafts', {
  id: int('id').autoincrement().notNull(),
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
  student_mobile: varchar('student_mobile', { length: 20 }),
  guardian_mobile: varchar('guardian_mobile', { length: 20 }),
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
  annual_income: int('annual_income'),
  aadhaar_no: varchar('aadhaar_no', { length: 12 }),
  fee_reimbursement: mysqlEnum('fee_reimbursement', ['YES', 'NO', 'GOV']),
  identification_mark_1: text('identification_mark_1'),
  identification_mark_2: text('identification_mark_2'),
  permanent_address: text('permanent_address'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
});

export const academicCalendar = mysqlTable('academic_calendar', {
  id: int('id').autoincrement().notNull(),
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
}));


export const studentAttendance = mysqlTable('student_attendance', {
  id: int('id').autoincrement().notNull(),
  student_id: int('student_id').notNull(),
  assignment_id: int('assignment_id').notNull(),
  date: date('date').notNull(),
  session: int('session').notNull(),
  status: mysqlEnum('status', ['PRESENT', 'ABSENT', 'NCC', 'MEDICAL']).notNull(),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  attendanceIdx: index('idx_attendance_lookup').on(table.assignment_id, table.date, table.session),
  historyIdx: index('idx_student_attendance_history').on(table.student_id, table.date),
}));

export const studentMarks = mysqlTable('student_marks', {
  id: int('id').autoincrement().notNull(),
  student_id: int('student_id').notNull(),
  assignment_id: int('assignment_id').notNull(),
  mid1_marks: decimal('mid1_marks', { precision: 5, scale: 2 }),
  mid2_marks: decimal('mid2_marks', { precision: 5, scale: 2 }),
  assignment_marks: decimal('assignment_marks', { precision: 5, scale: 2 }),
  lab_theory_marks: decimal('lab_theory_marks', { precision: 5, scale: 2 }),
  lab_execution_marks: decimal('lab_execution_marks', { precision: 5, scale: 2 }),
  lab_record_marks: decimal('lab_record_marks', { precision: 5, scale: 2 }),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
});

// --- 4. DEPARTMENTAL & SCHEDULING ---

export const branchConfig = mysqlTable('branch_config', {
  id: int('id').autoincrement().notNull(),
  branch: varchar('branch', { length: 50 }).notNull(),
  academic_year: varchar('academic_year', { length: 9 }).notNull(),
  semester: tinyint('semester').notNull(),
  mid_max: int('mid_max').default(20),
  assignment_max: int('assignment_max').default(10),
  is_locked: boolean('is_locked').default(false),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
});

export const branchTimetable = mysqlTable('branch_timetable', {
  id: int('id').autoincrement().notNull(),
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
}, (table) => ({
  timetableLookupIdx: index('idx_timetable_lookup').on(table.branch, table.semester, table.academic_year),
}));

export const facultySubjectAssignments = mysqlTable('faculty_subject_assignments', {
  id: int('id').autoincrement().notNull(),
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
}));

// --- 5. SYLLABUS & CURRICULUM ---

export const syllabusSubjects = mysqlTable('syllabus_subjects', {
  subject_code: varchar('subject_code', { length: 50 }).notNull(),
  subject_name: varchar('subject_name', { length: 255 }).notNull(),
  subject_type: mysqlEnum('subject_type', ['theory', 'lab']).notNull(),
});

export const syllabusStructure = mysqlTable('syllabus_structure', {
  id: int('id').autoincrement().notNull(),
  branch: varchar('branch', { length: 50 }).notNull(),
  semester: tinyint('semester').notNull(),
  subject_code: varchar('subject_code', { length: 50 }).notNull(),
  is_group: boolean('is_group').default(false),
  parent_group_code: varchar('parent_group_code', { length: 50 }),
}, (table) => ({
  branchIdx: index('branch').on(table.branch, table.semester),
  subjectCodeIdx: index('subject_code').on(table.subject_code),
}));

export const syllabusUnits = mysqlTable('syllabus_units', {
  id: int('id').autoincrement().notNull(),
  subject_code: varchar('subject_code', { length: 50 }).notNull(),
  unit_order: tinyint('unit_order').notNull(),
  unit_name: varchar('unit_name', { length: 255 }).notNull(),
  topics: json('topics').notNull(),
});

// --- 6. ASSETS & SIGNATURES ---

export const studentImages = mysqlTable('student_images', {
  student_id: int('student_id').notNull(),
  pfp: text('pfp'),
});

export const studentSignatures = mysqlTable('student_signatures', {
  student_id: int('student_id').notNull(),
  signature: text('signature'),
  updated_at: timestamp('updated_at').onUpdateNow(),
});

// --- 7. REQUESTS & CERTIFICATES ---

export const studentRequests = mysqlTable('student_requests', {
  request_id: int('request_id').autoincrement().notNull(),
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
}, (table) => ({
  genCertIdx: index('idx_gen_cert_id').on(table.generated_certificate_id),
}));

export const studentRequestImages = mysqlTable('student_request_images', {
  request_id: int('request_id').notNull(),
  payment_screenshot: text('payment_screenshot'),
});

export const certificateVerifications = mysqlTable('certificate_verifications', {
  id: int('id').autoincrement().notNull(),
  request_id: int('request_id').notNull(),
  verification_date: timestamp('verification_date').defaultNow(),
  ip_address: varchar('ip_address', { length: 45 }),
  user_agent: text('user_agent'),
});

// --- 8. SECURITY & UTILITY ---

export const otpCodes = mysqlTable('otp_codes', {
  id: int('id').autoincrement().notNull(),
  roll_no: varchar('roll_no', { length: 255 }).notNull(),
  otp_code: varchar('otp_code', { length: 6 }).notNull(),
  created_at: timestamp('created_at').defaultNow(),
  expires_at: timestamp('expires_at').notNull(),
});

export const passwordResetTokens = mysqlTable('password_reset_tokens', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().notNull(),
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
  key_name: varchar('key_name', { length: 255 }).notNull(),
  points: int('points').default(0),
  expire_at: timestamp('expire_at').notNull(),
}, (table) => ({
  expireIdx: index('idx_expire').on(table.expire_at),
}));

// --- 9. SCHOLARSHIP & FINANCE ---

export const scholarshipSanctions = mysqlTable('scholarship_sanctions', {
  id: int('id').autoincrement().notNull(),
  student_id: int('student_id').notNull(),
  academic_year: varchar('academic_year', { length: 9 }).notNull(),
  application_no: varchar('application_no', { length: 255 }).notNull(),
  proceeding_no: varchar('proceeding_no', { length: 255 }),
  sanctioned_amount: decimal('sanctioned_amount', { precision: 10, scale: 2 }),
  sanction_date: date('sanction_date'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
  thumb_update_available: boolean('thumb_update_available').default(false),
  thumb_status: mysqlEnum('thumb_status', ['PENDING', 'COMPLETE']).default('PENDING'),
  hardcopy_submitted: tinyint('hardcopy_submitted').default(0),
}, (table) => ({
  appYearIdx: index('idx_scholarship_app_year').on(table.application_no, table.academic_year),
  searchIdx: index('idx_scholarship_search').on(table.student_id, table.academic_year),
}));

export const scholarshipWindows = mysqlTable('scholarship_windows', {
  id: int('id').autoincrement().notNull(),
  academic_year: varchar('academic_year', { length: 9 }),
  start_date: date('start_date'),
  end_date: date('end_date'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
});

export const studentFeePayments = mysqlTable('student_fee_payments', {
  id: int('id').autoincrement().notNull(),
  student_id: int('student_id').notNull(),
  academic_year: varchar('academic_year', { length: 9 }).notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  transaction_ref_no: varchar('transaction_ref_no', { length: 255 }).notNull(),
  transaction_date: date('transaction_date').notNull(),
  payment_mode: varchar('payment_mode', { length: 50 }),
  bank_name: varchar('bank_name', { length: 255 }),
  created_at: timestamp('created_at').defaultNow(),
});

// --- 10. REAL-TIME & SESSIONS ---

export const attendanceSessions = mysqlTable('attendance_sessions', {
  id: int('id').autoincrement().notNull(),
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
}));

export const attendanceSessionLogs = mysqlTable('attendance_session_logs', {
  id: int('id').autoincrement().notNull(),
  session_id: int('session_id').notNull(),
  student_id: int('student_id').notNull(),
  device_hash: varchar('device_hash', { length: 255 }),
  ip_address: varchar('ip_address', { length: 45 }),
  ua_hash: varchar('ua_hash', { length: 32 }),
  status: mysqlEnum('status', ['SUCCESS', 'FAILED_LOCATION', 'FAILED_EXPIRED']).default('SUCCESS'),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  sessionIpUaIdx: index('idx_session_ip_ua').on(table.session_id, table.ip_address, table.ua_hash),
}));

// --- 11. SEMESTER MANAGEMENT ---

export const semesters = mysqlTable('semesters', {
  id: int('id').autoincrement().notNull(),
  academic_year: varchar('academic_year', { length: 9 }).notNull(),
  semester: tinyint('semester').notNull(),
  start_date: date('start_date').notNull(),
  end_date: date('end_date').notNull(),
  weekend_pattern: json('weekend_pattern').notNull(),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
});

export const facultySubjectInterests = mysqlTable('faculty_subject_interests', {
  id: int('id').autoincrement().notNull(),
  faculty_id: int('faculty_id').notNull(),
  subject_code: varchar('subject_code', { length: 50 }).notNull(),
  subject_name: varchar('subject_name', { length: 255 }).notNull(),
  branch: varchar('branch', { length: 50 }).notNull(),
  semester: int('semester').notNull(),
  academic_year: varchar('academic_year', { length: 9 }).notNull(),
  status: mysqlEnum('status', ['PENDING', 'APPROVED', 'REJECTED']).default('PENDING').notNull(),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
});

export const studentProfileRequests = mysqlTable('student_profile_requests', {
  id: int('id').autoincrement().notNull(),
  student_id: int('student_id').notNull(),
  new_signature: text('new_signature'),
  new_pfp: text('new_pfp'),
  new_data: json('new_data'),
  proof_url: text('proof_url'),
  status: mysqlEnum('status', ['pending', 'approved', 'rejected']).default('pending'),
  rejection_reason: text('rejection_reason'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
});

export const studentImportLogs = mysqlTable('student_import_logs', {
  id: int('id').autoincrement().notNull(),
  clerk_id: int('clerk_id').notNull(),
  total_records: int('total_records').notNull(),
  file_name: varchar('file_name', { length: 255 }),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  importCreatedAtIdx: index('idx_import_created_at').on(table.created_at),
}));

export const auditLogs = mysqlTable('audit_logs', {
  id: int('id').autoincrement().notNull().primaryKey(),
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
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().notNull().primaryKey(),
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

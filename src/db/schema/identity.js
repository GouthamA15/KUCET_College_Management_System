import { 
  mysqlTable, varchar, int, boolean, text, timestamp, 
  mysqlEnum, bigint, index, uniqueIndex, date
} from 'drizzle-orm/mysql-core';

export const students = mysqlTable('students', {
  id: int('id').autoincrement().primaryKey().notNull(),
  admission_no: varchar('admission_no', { length: 255 }),
  roll_no: varchar('roll_no', { length: 255 }),
  fee_reimbursement: mysqlEnum('fee_reimbursement', ['YES', 'NO', 'GOV']).default('NO').notNull(),
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
  academic_status: mysqlEnum('academic_status', ['REGULAR', 'ACTIVE', 'GRADUATED', 'DETAINED', 'SUSPENDED', 'DROPPED']).default('ACTIVE'),
  academic_offset_years: int('academic_offset_years').default(0),
  last_login_at: timestamp('last_login_at'),
  last_login_ip: varchar('last_login_ip', { length: 64 }),
  password_changed_at: timestamp('password_changed_at'),
  data_policy_consented_at: timestamp('data_policy_consented_at'),
  gps_consent_granted_at: timestamp('gps_consent_granted_at'),
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
  must_change_password: boolean('must_change_password').default(false).notNull(),
}, (table) => ({
  emailIdx: index('idx_clerks_email').on(table.email),
  employeeIdIdx: index('idx_clerks_employee_id').on(table.employee_id),
}));

export const staffRegistrationRequests = mysqlTable('staff_registration_requests', {
  id: int('id').autoincrement().primaryKey().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  employee_id: varchar('employee_id', { length: 255 }).notNull(),
  staff_category: varchar('staff_category', { length: 50 }).notNull().default('FACULTY'),
  branch: varchar('branch', { length: 50 }),
  department: varchar('department', { length: 100 }),
  designation: varchar('designation', { length: 100 }),
  mobile: varchar('mobile', { length: 255 }), // Encrypted
  mobile_hash: varchar('mobile_hash', { length: 64 }), // Searchable Blind Index
  pfp: text('pfp'),
  signature: text('signature'),
  status: mysqlEnum('status', ['PENDING', 'APPROVED', 'REJECTED']).default('PENDING').notNull(),
  rejection_reason: text('rejection_reason'),
  processed_at: timestamp('processed_at'),
  processed_by_admin_id: int('processed_by_admin_id'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
}, (table) => ({
  emailIdx: index('idx_clerk_req_email').on(table.email),
  employeeIdIdx: index('idx_clerk_req_employee_id').on(table.employee_id),
  statusIdx: index('idx_clerk_req_status').on(table.status),
  categoryIdx: index('idx_clerk_req_category').on(table.staff_category),
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

export const refreshTokens = mysqlTable('refresh_tokens', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey().notNull(),
  token_hash: varchar('token_hash', { length: 255 }).notNull(),
  user_id: varchar('user_id', { length: 255 }).notNull(),
  user_type: mysqlEnum('user_type', ['student', 'clerk', 'admin']).notNull(),
  expires_at: timestamp('expires_at').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  revoked_at: timestamp('revoked_at'),
  replaced_by_token_id: bigint('replaced_by_token_id', { mode: 'number', unsigned: true }),
}, (table) => ({
  tokenHashIdx: index('idx_refresh_token_hash').on(table.token_hash),
  userIdIdx: index('idx_refresh_user').on(table.user_id, table.user_type),
}));

export const otpCodes = mysqlTable('otp_codes', {
  id: int('id').autoincrement().primaryKey().notNull(),
  identifier: varchar('identifier', { length: 255 }).notNull(),
  otp_code: varchar('otp_code', { length: 64 }).notNull(),
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

export const staffAccounts = mysqlTable('staff_accounts', {
  id: int('id').autoincrement().primaryKey().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  employee_id: varchar('employee_id', { length: 255 }).notNull(),
  password_hash: varchar('password_hash', { length: 255 }),
  staff_category: varchar('staff_category', { length: 50 }).notNull(),
  designation: varchar('designation', { length: 100 }).notNull(),
  mobile_hash: varchar('mobile_hash', { length: 64 }),
  pfp: text('pfp'),
  signature: text('signature'),
  address: text('address'),
  account_status: mysqlEnum('account_status', ['PENDING_ACTIVATION', 'ACTIVE', 'SUSPENDED']).default('PENDING_ACTIVATION').notNull(),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
}, (table) => ({
  emailIdx: uniqueIndex('idx_staff_email').on(table.email),
  employeeIdIdx: uniqueIndex('idx_staff_employee_id').on(table.employee_id),
}));

export const staffAccountRoles = mysqlTable('staff_account_roles', {
  id: int('id').autoincrement().primaryKey().notNull(),
  staff_id: int('staff_id').notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  staffIdIdx: index('idx_staff_role_id').on(table.staff_id),
  roleIdx: index('idx_staff_role').on(table.role),
}));

export const staffAcademicAffiliations = mysqlTable('staff_academic_affiliations', {
  id: int('id').autoincrement().primaryKey().notNull(),
  staff_id: int('staff_id').notNull(),
  department_id: int('department_id').notNull(),
  program_id: int('program_id').notNull(),
  is_primary: boolean('is_primary').default(false).notNull(),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  staffIdIdx: index('idx_staff_affil_id').on(table.staff_id),
  deptProgIdx: index('idx_staff_affil_dept_prog').on(table.department_id, table.program_id),
}));

export const staffAccountActivationTokens = mysqlTable('staff_account_activation_tokens', {
  id: int('id').autoincrement().primaryKey().notNull(),
  staff_id: int('staff_id').notNull(),
  token_hash: varchar('token_hash', { length: 255 }).notNull(),
  expires_at: timestamp('expires_at').notNull(),
  used_at: timestamp('used_at'),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  staffIdIdx: index('idx_staff_token_staff_id').on(table.staff_id),
  tokenHashIdx: index('idx_staff_token_hash').on(table.token_hash),
}));

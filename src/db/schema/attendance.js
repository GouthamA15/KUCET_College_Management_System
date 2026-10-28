import { 
  mysqlTable, varchar, int, boolean, decimal, timestamp, 
  mysqlEnum, float, index, uniqueIndex, date, text
} from 'drizzle-orm/mysql-core';

export const studentAttendance = mysqlTable('student_attendance', {
  id: int('id').autoincrement().primaryKey().notNull(),
  student_id: int('student_id').notNull(),
  assignment_id: int('assignment_id').notNull(),
  date: date('date').notNull(),
  session: int('session').notNull(),
  status: mysqlEnum('status', ['PRESENT', 'ABSENT', 'NCC', 'MEDICAL']).notNull(),
  submitted_at: timestamp('submitted_at'),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  attendanceIdx: index('idx_attendance_lookup').on(table.assignment_id, table.date, table.session),
  historyIdx: index('idx_student_attendance_history').on(table.student_id, table.date),
  studentAssignmentIdx: index('idx_sa_student_assignment').on(table.student_id, table.assignment_id),
  studentStatusDateIdx: index('idx_att_student_status_date').on(table.student_id, table.status, table.date),
  uqAttendance: uniqueIndex('uq_student_attendance').on(table.student_id, table.assignment_id, table.date, table.session),
}));

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
  topic_covered: varchar('topic_covered', { length: 500 }),
  submitted_at: timestamp('submitted_at'),
}, (table) => ({
  assignmentActiveIdx: index('idx_assignment_active').on(table.assignment_id, table.is_active),
  sessionsActiveIdx: index('idx_sessions_active').on(table.is_active, table.expires_at),
  tokenIdx: index('idx_session_token').on(table.session_token),
  facultyIdx: index('idx_as_faculty').on(table.faculty_id),
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

export const studentAttendanceDisputes = mysqlTable('student_attendance_disputes', {
  id: int('id').autoincrement().primaryKey().notNull(),
  student_id: int('student_id').notNull(),
  assignment_id: int('assignment_id').notNull(),
  attendance_date: date('attendance_date').notNull(),
  session: int('session').notNull(),
  original_status: mysqlEnum('original_status', ['ABSENT']).default('ABSENT').notNull(),
  requested_status: mysqlEnum('requested_status', ['PRESENT', 'NCC', 'MEDICAL']).default('PRESENT').notNull(),
  category: varchar('category', { length: 50 }).default('INCORRECT_MARKING').notNull(),
  reason: text('reason').notNull(),
  additional_explanation: text('additional_explanation'),
  student_declaration: boolean('student_declaration').default(true).notNull(),
  proof_url: varchar('proof_url', { length: 500 }),
  status: mysqlEnum('status', ['PENDING', 'APPROVED', 'REJECTED', 'MORE_INFO_REQUIRED']).default('PENDING').notNull(),
  reviewed_by_staff_id: int('reviewed_by_staff_id'),
  reviewed_at: timestamp('reviewed_at'),
  rejection_reason: text('rejection_reason'),
  reviewer_comments: text('reviewer_comments'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
}, (table) => ({
  studentIdx: index('idx_sad_student').on(table.student_id),
  assignmentDateIdx: index('idx_sad_assignment_date').on(table.assignment_id, table.attendance_date),
  statusIdx: index('idx_sad_status').on(table.status),
  uqDispute: uniqueIndex('uq_student_dispute_session').on(table.student_id, table.assignment_id, table.attendance_date, table.session),
}));

export const attendanceDisputeAttachments = mysqlTable('attendance_dispute_attachments', {
  id: int('id').autoincrement().primaryKey().notNull(),
  dispute_id: int('dispute_id').notNull(),
  student_id: int('student_id').notNull(),
  file_key: varchar('file_key', { length: 500 }).notNull(),
  file_name: varchar('file_name', { length: 255 }).notNull(),
  file_size: int('file_size').notNull(),
  mime_type: varchar('mime_type', { length: 100 }).notNull(),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  disputeIdx: index('idx_ada_dispute').on(table.dispute_id),
  studentIdx: index('idx_ada_student').on(table.student_id),
}));

export const attendanceAuditLogs = mysqlTable('attendance_audit_logs', {
  id: int('id').autoincrement().primaryKey().notNull(),
  student_id: int('student_id').notNull(),
  assignment_id: int('assignment_id').notNull(),
  attendance_date: date('attendance_date').notNull(),
  session: int('session').notNull(),
  previous_status: varchar('previous_status', { length: 20 }),
  new_status: varchar('new_status', { length: 20 }).notNull(),
  modified_by_staff_id: int('modified_by_staff_id').notNull(),
  change_type: varchar('change_type', { length: 50 }).default('MANUAL_CORRECTION').notNull(), // 'DISPUTE_APPROVAL', 'MANUAL_CORRECTION'
  dispute_id: int('dispute_id'),
  reason: text('reason'),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  studentDateIdx: index('idx_aal_student_date').on(table.student_id, table.attendance_date),
  assignmentIdx: index('idx_aal_assignment').on(table.assignment_id),
  disputeIdx: index('idx_aal_dispute').on(table.dispute_id),
}));

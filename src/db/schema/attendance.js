import { 
  mysqlTable, varchar, int, boolean, decimal, timestamp, 
  mysqlEnum, float, index, uniqueIndex, date
} from 'drizzle-orm/mysql-core';

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

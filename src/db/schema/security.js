import { 
  mysqlTable, varchar, int, boolean, text, json, timestamp, 
  mysqlEnum, bigint, index
} from 'drizzle-orm/mysql-core';

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

export const rateLimits = mysqlTable('rate_limits', {
  key_name: varchar('key_name', { length: 255 }).notNull().primaryKey(),
  points: int('points').default(0),
  expire_at: timestamp('expire_at').notNull(),
}, (table) => ({
  expireIdx: index('idx_expire').on(table.expire_at),
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

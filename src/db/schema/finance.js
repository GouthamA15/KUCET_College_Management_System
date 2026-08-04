import { 
  mysqlTable, varchar, int, boolean, decimal, json, timestamp, 
  mysqlEnum, tinyint, bigint, index, uniqueIndex, date
} from 'drizzle-orm/mysql-core';

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
  transactionRefUniq: uniqueIndex('uq_sfp_transaction_ref_no').on(table.transaction_ref_no),
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

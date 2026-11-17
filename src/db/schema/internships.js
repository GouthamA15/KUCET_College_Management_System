import { 
  mysqlTable, varchar, int, boolean, text, decimal, json, timestamp, 
  mysqlEnum, date, index, uniqueIndex 
} from 'drizzle-orm/mysql-core';
import { students, staffAccounts } from './identity.js';

export const internshipCompanies = mysqlTable('internship_companies', {
  id: int('id').autoincrement().primaryKey().notNull(),
  company_name: varchar('company_name', { length: 255 }).notNull(),
  normalized_name: varchar('normalized_name', { length: 255 }).notNull(),
  website: varchar('website', { length: 255 }),
  industry: varchar('industry', { length: 100 }),
  address: text('address'),
  location: varchar('location', { length: 150 }),
  contact_person: varchar('contact_person', { length: 150 }),
  contact_email: varchar('contact_email', { length: 150 }),
  contact_phone: varchar('contact_phone', { length: 50 }),
  verification_status: mysqlEnum('verification_status', [
    'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'INACTIVE'
  ]).default('PENDING_VERIFICATION').notNull(),
  verified_by: int('verified_by').references(() => staffAccounts.id, { onDelete: 'set null' }),
  verified_at: timestamp('verified_at'),
  rejection_reason: text('rejection_reason'),
  is_active: boolean('is_active').default(true).notNull(),
  created_by_user_type: mysqlEnum('created_by_user_type', ['STAFF', 'STUDENT', 'ADMIN']).default('STAFF').notNull(),
  created_by_id: int('created_by_id'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
}, (table) => ({
  normNameIdx: index('idx_ic_norm_name').on(table.normalized_name),
  statusIdx: index('idx_ic_status').on(table.verification_status, table.is_active),
}));

export const internshipOpportunities = mysqlTable('internship_opportunities', {
  id: int('id').autoincrement().primaryKey().notNull(),
  company_id: int('company_id').notNull().references(() => internshipCompanies.id, { onDelete: 'restrict' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  category: varchar('category', { length: 100 }).default('General Engineering').notNull(),
  required_skills: text('required_skills'),
  required_qualifications: text('required_qualifications'),
  eligible_branches: json('eligible_branches').notNull(), // array of branch codes: ["CSE", "IT", ...] or ["ALL"]
  eligible_academic_years: json('eligible_academic_years').notNull(), // array of academic years: ["2024-2025", ...] or ["ALL"]
  min_cgpa: decimal('min_cgpa', { precision: 4, scale: 2 }),
  start_date: date('start_date'),
  end_date: date('end_date'),
  duration: varchar('duration', { length: 50 }),
  mode: mysqlEnum('mode', ['ONLINE', 'OFFLINE', 'HYBRID']).default('HYBRID').notNull(),
  location: varchar('location', { length: 150 }),
  stipend: varchar('stipend', { length: 100 }),
  openings_count: int('openings_count').default(1).notNull(),
  opening_date: date('opening_date'),
  deadline: date('deadline').notNull(),
  additional_requirements: text('additional_requirements'),
  status: mysqlEnum('status', [
    'DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'CLOSED', 'ARCHIVED'
  ]).default('DRAFT').notNull(),
  published_at: timestamp('published_at'),
  created_by_staff_id: int('created_by_staff_id').references(() => staffAccounts.id, { onDelete: 'set null' }),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
}, (table) => ({
  companyIdx: index('idx_io_company').on(table.company_id),
  statusDeadlineIdx: index('idx_io_status_deadline').on(table.status, table.deadline),
}));

export const studentInternships = mysqlTable('student_internships', {
  id: int('id').autoincrement().primaryKey().notNull(),
  student_id: int('student_id').notNull().references(() => students.id, { onDelete: 'restrict' }),
  registration_type: mysqlEnum('registration_type', [
    'INTERNAL_APPLICATION', 'EXTERNAL_SELF_IDENTIFIED'
  ]).notNull(),
  opportunity_id: int('opportunity_id').references(() => internshipOpportunities.id, { onDelete: 'set null' }),
  company_id: int('company_id').references(() => internshipCompanies.id, { onDelete: 'set null' }),
  company_name: varchar('company_name', { length: 255 }).notNull(),
  company_website: varchar('company_website', { length: 255 }),
  company_location: varchar('company_location', { length: 150 }),
  role_title: varchar('role_title', { length: 255 }).notNull(),
  description: text('description'),
  mode: mysqlEnum('mode', ['ONLINE', 'OFFLINE', 'HYBRID']).default('HYBRID').notNull(),
  start_date: date('start_date').notNull(),
  end_date: date('end_date').notNull(),
  duration: varchar('duration', { length: 50 }),
  stipend: varchar('stipend', { length: 100 }),
  supervisor_name: varchar('supervisor_name', { length: 150 }),
  supervisor_email: varchar('supervisor_email', { length: 150 }),
  supervisor_phone: varchar('supervisor_phone', { length: 50 }),
  skills_acquired: text('skills_acquired'),
  statement_of_interest: text('statement_of_interest'),
  
  // Application Lifecycle Status
  application_status: mysqlEnum('application_status', [
    'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'ADDITIONAL_INFO_REQUIRED', 'APPROVED', 'REJECTED', 'WITHDRAWAL_REQUESTED', 'WITHDRAWN'
  ]).default('SUBMITTED').notNull(),
  
  // Execution / On-ground Internship Status
  internship_status: mysqlEnum('internship_status', [
    'NOT_STARTED', 'ONGOING', 'COMPLETED', 'TERMINATED'
  ]).default('NOT_STARTED').notNull(),
  stage: mysqlEnum('stage', ['UPCOMING', 'ONGOING', 'COMPLETED']).default('UPCOMING').notNull(),
  
  // Coordinator Application Review Fields
  reviewed_by_staff_id: int('reviewed_by_staff_id').references(() => staffAccounts.id, { onDelete: 'set null' }),
  reviewed_at: timestamp('reviewed_at'),
  rejection_reason: text('rejection_reason'),
  coordinator_remarks: text('coordinator_remarks'),
  additional_info_instructions: text('additional_info_instructions'),

  // Unverified Company Exception Approval
  is_unverified_company_exception: boolean('is_unverified_company_exception').default(false).notNull(),
  unverified_company_exception_reason: text('unverified_company_exception_reason'),
  unverified_company_exception_by: int('unverified_company_exception_by').references(() => staffAccounts.id, { onDelete: 'set null' }),
  unverified_company_exception_at: timestamp('unverified_company_exception_at'),

  // Date Overlap Warning Flags
  has_overlap_warning: boolean('has_overlap_warning').default(false).notNull(),
  overlap_details: text('overlap_details'),

  // Withdrawal Request Fields
  withdrawal_reason: text('withdrawal_reason'),
  withdrawal_requested_at: timestamp('withdrawal_requested_at'),
  withdrawal_reviewed_by: int('withdrawal_reviewed_by').references(() => staffAccounts.id, { onDelete: 'set null' }),
  withdrawal_reviewed_at: timestamp('withdrawal_reviewed_at'),
  withdrawal_remarks: text('withdrawal_remarks'),
  
  // Completion Verification Workflow Fields
  completion_status: mysqlEnum('completion_status', [
    'NOT_SUBMITTED', 'SUBMITTED_FOR_VERIFICATION', 'VERIFIED_COMPLETED', 'VERIFICATION_REJECTED', 'ADDITIONAL_DOCS_REQUESTED'
  ]).default('NOT_SUBMITTED').notNull(),
  actual_completion_date: date('actual_completion_date'),
  student_completion_remarks: text('student_completion_remarks'),
  verified_by_staff_id: int('verified_by_staff_id').references(() => staffAccounts.id, { onDelete: 'set null' }),
  verified_at: timestamp('verified_at'),
  verification_remarks: text('verification_remarks'),
  
  // Forward-compatible Internship Credits Schema Support (Disabled in UI)
  credits_eligible: int('credits_eligible').default(0).notNull(),
  credits_awarded: int('credits_awarded').default(0).notNull(),
  credits_approved_by: int('credits_approved_by').references(() => staffAccounts.id, { onDelete: 'set null' }),
  credits_approved_at: timestamp('credits_approved_at'),
  
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
}, (table) => ({
  studentIdx: index('idx_si_student').on(table.student_id),
  opportunityIdx: index('idx_si_opportunity').on(table.opportunity_id),
  companyIdx: index('idx_si_company').on(table.company_id),
  appStatusIdx: index('idx_si_app_status').on(table.application_status),
  lifecycleStatusIdx: index('idx_si_lifecycle_status').on(table.internship_status),
  completionStatusIdx: index('idx_si_completion_status').on(table.completion_status),
  uqStudentInternalOpp: uniqueIndex('uq_student_internal_opp').on(table.student_id, table.opportunity_id),
}));

export const internshipDocuments = mysqlTable('internship_documents', {
  id: int('id').autoincrement().primaryKey().notNull(),
  internship_id: int('internship_id').notNull().references(() => studentInternships.id, { onDelete: 'cascade' }),
  student_id: int('student_id').notNull().references(() => students.id, { onDelete: 'restrict' }),
  document_type: mysqlEnum('document_type', [
    'OFFER_LETTER', 'JOINING_LETTER', 'COMPLETION_CERTIFICATE', 'INTERNSHIP_REPORT', 'RECOMMENDATION_LETTER', 'OTHER_SUPPORTING_DOCUMENT'
  ]).notNull(),
  original_filename: varchar('original_filename', { length: 255 }).notNull(),
  storage_key: varchar('storage_key', { length: 500 }).notNull(),
  mime_type: varchar('mime_type', { length: 100 }).default('application/pdf').notNull(),
  file_size_bytes: int('file_size_bytes').default(0).notNull(),
  verification_status: mysqlEnum('verification_status', [
    'PENDING', 'VERIFIED', 'REJECTED', 'SUPERSEDED'
  ]).default('PENDING').notNull(),
  verified_by_staff_id: int('verified_by_staff_id').references(() => staffAccounts.id, { onDelete: 'set null' }),
  verified_at: timestamp('verified_at'),
  rejection_reason: text('rejection_reason'),
  version: int('version').default(1).notNull(),
  uploaded_by_user_type: mysqlEnum('uploaded_by_user_type', ['STUDENT', 'STAFF', 'ADMIN']).default('STUDENT').notNull(),
  uploaded_by_id: int('uploaded_by_id'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
}, (table) => ({
  internshipIdx: index('idx_idoc_internship').on(table.internship_id),
  studentIdx: index('idx_idoc_student').on(table.student_id),
  docTypeIdx: index('idx_idoc_type').on(table.document_type),
}));

export const internshipAuditLogs = mysqlTable('internship_audit_logs', {
  id: int('id').autoincrement().primaryKey().notNull(),
  internship_id: int('internship_id').references(() => studentInternships.id, { onDelete: 'set null' }),
  opportunity_id: int('opportunity_id').references(() => internshipOpportunities.id, { onDelete: 'set null' }),
  company_id: int('company_id').references(() => internshipCompanies.id, { onDelete: 'set null' }),
  actor_type: mysqlEnum('actor_type', ['STUDENT', 'STAFF', 'ADMIN', 'SYSTEM']).notNull(),
  actor_id: int('actor_id').notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  details: json('details'),
  ip_address: varchar('ip_address', { length: 64 }),
  user_agent: text('user_agent'),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  internshipIdx: index('idx_iaudit_internship').on(table.internship_id),
  actionIdx: index('idx_iaudit_action').on(table.action),
  actorIdx: index('idx_iaudit_actor').on(table.actor_type, table.actor_id),
}));

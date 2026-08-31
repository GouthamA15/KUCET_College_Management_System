import { 
  mysqlTable, varchar, int, boolean, text, json, timestamp, 
  mysqlEnum, index, uniqueIndex, date
} from 'drizzle-orm/mysql-core';

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

  perm_house_no: varchar('perm_house_no', { length: 255 }),
  perm_street: varchar('perm_street', { length: 255 }),
  perm_apartment: varchar('perm_apartment', { length: 255 }),
  perm_city: varchar('perm_city', { length: 255 }),
  perm_state: varchar('perm_state', { length: 255 }),
  perm_pincode: varchar('perm_pincode', { length: 20 }),
  perm_country: varchar('perm_country', { length: 100 }).default('India'),

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
  studentIdUniq: uniqueIndex('uq_spd_student_id').on(table.student_id),
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
  studentIdUniq: uniqueIndex('uq_sab_student_id').on(table.student_id),
}));

export const studentAdmissionDrafts = mysqlTable('student_admission_drafts', {
  id: int('id').autoincrement().primaryKey().notNull(),
  status: mysqlEnum('status', ['DRAFT', 'PROCESSED', 'FINALIZED', 'REJECTED']).default('DRAFT').notNull(),
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

  perm_house_no: varchar('perm_house_no', { length: 255 }),
  perm_street: varchar('perm_street', { length: 255 }),
  perm_apartment: varchar('perm_apartment', { length: 255 }),
  perm_city: varchar('perm_city', { length: 255 }),
  perm_state: varchar('perm_state', { length: 255 }),
  perm_pincode: varchar('perm_pincode', { length: 20 }),
  perm_country: varchar('perm_country', { length: 100 }).default('India'),

  curr_house_no: varchar('curr_house_no', { length: 255 }),
  curr_street: varchar('curr_street', { length: 255 }),
  curr_apartment: varchar('curr_apartment', { length: 255 }),
  curr_city: varchar('curr_city', { length: 255 }),
  curr_state: varchar('curr_state', { length: 255 }),
  curr_pincode: varchar('curr_pincode', { length: 20 }),
  curr_country: varchar('curr_country', { length: 100 }).default('India'),

  is_current_same_as_permanent: boolean('is_current_same_as_permanent').default(false),

  admission_date: date('admission_date'),
  data_policy_consented_at: timestamp('data_policy_consented_at'),
  roll_no: varchar('roll_no', { length: 255 }),
  rejection_reason: text('rejection_reason'),
  rejected_by_staff_id: int('rejected_by_staff_id'),
  rejected_at: timestamp('rejected_at'),
  restored_by_staff_id: int('restored_by_staff_id'),
  restored_at: timestamp('restored_at'),
  restoration_reason: text('restoration_reason'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
}, (table) => ({
  emailIdx: index('idx_draft_email').on(table.email),
  mobileHashIdx: index('idx_draft_mobile_hash').on(table.mobile_hash),
  aadhaarHashIdx: index('idx_draft_aadhaar_hash').on(table.aadhaar_hash),
  statusIdx: index('idx_draft_status').on(table.status),
}));

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
  staff_id: int('staff_id').notNull(),
  total_records: int('total_records').notNull(),
  file_name: varchar('file_name', { length: 255 }),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  importCreatedAtIdx: index('idx_import_created_at').on(table.created_at),
}));

export const admissionStatusHistory = mysqlTable('admission_status_history', {
  id: int('id').autoincrement().primaryKey().notNull(),
  draft_id: int('draft_id').notNull(),
  old_status: varchar('old_status', { length: 50 }),
  new_status: varchar('new_status', { length: 50 }).notNull(),
  reason: text('reason'),
  changed_by_user_id: int('changed_by_user_id'),
  changed_by_user_type: varchar('changed_by_user_type', { length: 50 }).default('staff'),
  metadata: json('metadata'),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  draftIdx: index('idx_ash_draft_id').on(table.draft_id),
  createdAtIdx: index('idx_ash_created_at').on(table.created_at),
}));

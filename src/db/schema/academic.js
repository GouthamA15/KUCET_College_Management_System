import { 
  mysqlTable, varchar, int, boolean, text, json, timestamp, 
  mysqlEnum, tinyint, index, uniqueIndex, date
} from 'drizzle-orm/mysql-core';

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

export const syllabusSubjects = mysqlTable('syllabus_subjects', {
  subject_code: varchar('subject_code', { length: 50 }).notNull().primaryKey(),
  subject_name: varchar('subject_name', { length: 255 }).notNull(),
  subject_type: mysqlEnum('subject_type', ['theory', 'lab']).notNull(),
});

export const syllabusStructure = mysqlTable('syllabus_structure', {
  id: int('id').autoincrement().primaryKey().notNull(),
  branch: varchar('branch', { length: 50 }).notNull(),
  semester: tinyint('semester').notNull(),
  subject_code: varchar('subject_code', { length: 50 }).notNull().references(() => syllabusSubjects.subject_code, { onDelete: 'restrict' }),
  is_group: boolean('is_group').default(false),
  parent_group_code: varchar('parent_group_code', { length: 50 }),
}, (table) => ({
  branchIdx: index('branch').on(table.branch, table.semester),
  subjectCodeIdx: index('subject_code').on(table.subject_code),
  uqMapping: uniqueIndex('unique_mapping').on(table.branch, table.semester, table.subject_code),
}));

export const electiveGroups = mysqlTable('elective_groups', {
  id: int('id').autoincrement().primaryKey().notNull(),
  branch: varchar('branch', { length: 50 }).notNull(),
  semester: tinyint('semester').notNull(),
  group_code: varchar('group_code', { length: 50 }).notNull(),
  group_name: varchar('group_name', { length: 255 }).notNull(),
  group_type: mysqlEnum('group_type', ['PROFESSIONAL_ELECTIVE', 'OPEN_ELECTIVE', 'MANDATORY_NON_CREDIT', 'OTHER']).notNull(),
  subject_mode: mysqlEnum('subject_mode', ['theory', 'lab']).notNull().default('theory'),
  sequence_num: tinyint('sequence_num').notNull().default(0),
  display_order: int('display_order').notNull().default(0),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  uqGroup: uniqueIndex('uq_elective_group').on(table.branch, table.semester, table.group_code),
  branchSemIdx: index('idx_eg_branch_sem').on(table.branch, table.semester),
}));

export const electiveGroupSubjects = mysqlTable('elective_group_subjects', {
  id: int('id').autoincrement().primaryKey().notNull(),
  group_id: int('group_id').notNull().references(() => electiveGroups.id, { onDelete: 'restrict' }),
  subject_code: varchar('subject_code', { length: 50 }).notNull().references(() => syllabusSubjects.subject_code, { onDelete: 'restrict' }),
  display_order: int('display_order').notNull().default(0),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  uqGroupSubject: uniqueIndex('uq_group_subject').on(table.group_id, table.subject_code),
  groupIdIdx: index('idx_egs_group_id').on(table.group_id),
}));

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

export const academicDepartments = mysqlTable('academic_departments', {
  id: int('id').autoincrement().primaryKey().notNull(),
  department_code: varchar('department_code', { length: 50 }).notNull().unique(),
  department_name: varchar('department_name', { length: 255 }).notNull(),
  is_active: boolean('is_active').default(true),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
});

export const academicPrograms = mysqlTable('academic_programs', {
  id: int('id').autoincrement().primaryKey().notNull(),
  department_id: int('department_id').notNull(),
  program_code: varchar('program_code', { length: 50 }).notNull().unique(),
  program_name: varchar('program_name', { length: 255 }).notNull(),
  is_active: boolean('is_active').default(true),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
}, (table) => ({
  deptIdx: index('idx_academic_programs_dept').on(table.department_id),
}));

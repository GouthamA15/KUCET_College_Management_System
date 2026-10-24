/**
 * Automated Multi-Environment Baseline Rules Registry
 *
 * Used by src/db/migrate.js to ensure that existing database objects
 * (across Dev, Preview, and Production VPS environments) are safely detected
 * and recorded in `__drizzle_migrations` before Drizzle ORM executes migrations.
 *
 * This prevents DDL collisions (e.g. "Table already exists", "Duplicate column")
 * and ensures idempotent, multi-environment synchronization.
 */

const BASELINE_RULES = [
  {
    id: 'historical_0000_0015',
    description: 'Historical migrations (0000-0015)',
    getEntries: (entries) => entries.filter((e) => e.idx < 16),
    isSatisfied: async (conn) => {
      const [r] = await conn.query(
        'SELECT COUNT(*) as count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = "attendance_sessions" AND column_name = "topic_covered"'
      );
      return Number(r?.[0]?.count || 0) > 0;
    },
    getReason: () => 'historical schema detected',
  },
  {
    id: 16,
    description: '0016_reconcile_staff_and_hod_schema',
    getEntries: (entries) => entries.filter((e) => e.idx === 16),
    isSatisfied: async (conn) => {
      const [r] = await conn.query(
        'SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = "academic_departments"'
      );
      return Number(r?.[0]?.count || 0) > 0;
    },
    getReason: () => 'academic_departments table already exists',
  },
  {
    id: 17,
    description: '0017_add_staff_registration_address',
    getEntries: (entries) => entries.filter((e) => e.idx === 17),
    isSatisfied: async (conn) => {
      const [r] = await conn.query(
        'SELECT COUNT(*) as count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = "staff_registration_requests" AND column_name = "address"'
      );
      return Number(r?.[0]?.count || 0) > 0;
    },
    getReason: () => 'staff_registration_requests.address column already exists',
  },
  {
    id: 18,
    description: '0018_admission_rejection_and_history',
    getEntries: (entries) => entries.filter((e) => e.idx === 18),
    isSatisfied: async (conn) => {
      const [r] = await conn.query(
        'SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = "admission_status_history"'
      );
      return Number(r?.[0]?.count || 0) > 0;
    },
    getReason: () => 'admission_status_history table already exists',
  },
  {
    id: 19,
    description: '0019_timetable_instances',
    getEntries: (entries) => entries.filter((e) => e.idx === 19),
    isSatisfied: async (conn) => {
      const [r] = await conn.query(
        'SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = "timetable_instances"'
      );
      return Number(r?.[0]?.count || 0) > 0;
    },
    getReason: () => 'timetable_instances table already exists',
  },
  {
    id: 20,
    description: '0020_subject_module_and_elective_groups',
    getEntries: (entries) => entries.filter((e) => e.idx === 20),
    isSatisfied: async (conn) => {
      const [fsa] = await conn.query(
        'SELECT COUNT(*) as count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = "faculty_subject_assignments" AND column_name = "staff_account_id"'
      );
      const [eg] = await conn.query(
        'SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = "elective_groups"'
      );
      return Number(fsa?.[0]?.count || 0) > 0 && Number(eg?.[0]?.count || 0) > 0;
    },
    getReason: () => 'staff_account_id and elective_groups already exist',
  },
  {
    id: 21,
    description: '0021_students_achievements_schema',
    getEntries: (entries) => entries.filter((e) => e.idx === 21),
    isSatisfied: async (conn) => {
      const [r] = await conn.query(
        'SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = "student_achievements"'
      );
      return Number(r?.[0]?.count || 0) > 0;
    },
    getReason: () => 'student_achievements table already exists',
  },
  {
    id: 22,
    description: '0022_academic_calendar_attendance_disputes_and_workflows',
    getEntries: (entries) => entries.filter((e) => e.idx === 22),
    isSatisfied: async (conn) => {
      const [sad] = await conn.query(
        'SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = "student_attendance_disputes"'
      );
      const [sr] = await conn.query(
        'SELECT COUNT(*) as count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = "student_requests" AND column_name = "hod_approval_status"'
      );
      return Number(sad?.[0]?.count || 0) > 0 && Number(sr?.[0]?.count || 0) > 0;
    },
    getReason: () => 'student_attendance_disputes table and student_requests.hod_approval_status already exist',
  },
  {
    id: 23,
    description: '0023_principal_staff_role',
    getEntries: (entries) => entries.filter((e) => e.idx === 23),
    isSatisfied: async (conn) => {
      const [r] = await conn.query(
        'SELECT COUNT(*) as count FROM staff_roles WHERE role_code = "PRINCIPAL"'
      );
      return Number(r?.[0]?.count || 0) > 0;
    },
    getReason: () => 'PRINCIPAL role already exists in staff_roles',
  },
  {
    id: 24,
    description: '0024_canonical_gender_enum',
    getEntries: (entries) => entries.filter((e) => e.idx === 24),
    isSatisfied: async (conn) => {
      const [colStudents] = await conn.query(
        'SELECT COLUMN_TYPE FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = "students" AND column_name = "gender"'
      );
      const [colDrafts] = await conn.query(
        'SELECT COLUMN_TYPE FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = "student_admission_drafts" AND column_name = "gender"'
      );
      const isStudentsEnum = colStudents?.[0]?.COLUMN_TYPE?.toLowerCase()?.includes('enum');
      const isDraftsEnum = colDrafts?.[0]?.COLUMN_TYPE?.toLowerCase()?.includes('enum');
      return Boolean(isStudentsEnum && isDraftsEnum);
    },
    getReason: () => 'students and student_admission_drafts gender columns are already canonical ENUM',
  },
  {
    id: 26,
    description: '0026_faculty_coordinator_assignments',
    getEntries: (entries) => entries.filter((e) => e.idx === 26),
    isSatisfied: async (conn) => {
      const [tableRows] = await conn.query(
        'SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = "faculty_coordinator_assignments"'
      );
      return Number(tableRows?.[0]?.count || 0) > 0;
    },
    getReason: () => 'faculty_coordinator_assignments table already exists',
  },
  {
    id: 27,
    description: '0027_remove_class_section',
    getEntries: (entries) => entries.filter((e) => e.idx === 27),
    isSatisfied: async (conn) => {
      const [colRows] = await conn.query(
        'SELECT COUNT(*) as count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = "branch_timetable" AND column_name = "section"'
      );
      const [idxRows] = await conn.query(
        `SELECT column_name FROM information_schema.statistics
         WHERE table_schema = DATABASE() AND table_name = "branch_timetable" AND index_name = "uq_timetable_slot"
         ORDER BY seq_in_index`
      );
      const cols = (idxRows || []).map((r) => r.column_name);
      const expectedCols = ['branch', 'semester', 'day_of_week', 'period_number', 'academic_year'];
      const indexMatches = cols.length === expectedCols.length && cols.every((c, i) => c === expectedCols[i]);
      return Number(colRows?.[0]?.count || 0) === 0 && indexMatches;
    },
    getReason: () => 'branch_timetable.section is dropped and uq_timetable_slot matches canonical 5-column definition',
  },
];

module.exports = {
  BASELINE_RULES,
};

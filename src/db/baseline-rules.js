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
];

module.exports = {
  BASELINE_RULES,
};

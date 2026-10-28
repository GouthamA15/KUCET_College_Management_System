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
  {
    id: 28,
    description: '0028_add_apaar_id',
    getEntries: (entries) => entries.filter((e) => e.idx === 28),
    isSatisfied: async (conn) => {
      const [spd] = await conn.query(
        'SELECT COUNT(*) as count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = "student_personal_details" AND column_name = "apaar_id"'
      );
      const hasSpd = Number(spd?.[0]?.count || 0) > 0;
      if (!hasSpd) return false;

      // If student_personal_details already has apaar_id, ensure student_admission_drafts has it too
      try {
        const [drafts] = await conn.query(
          'SELECT COUNT(*) as count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = "student_admission_drafts" AND column_name = "apaar_id"'
        );
        if (Number(drafts?.[0]?.count || 0) === 0) {
          await conn.query('ALTER TABLE `student_admission_drafts` ADD COLUMN `apaar_id` varchar(20)');
          try {
            await conn.query('CREATE INDEX `idx_draft_apaar_id` ON `student_admission_drafts` (`apaar_id`)');
          } catch (_) {}
        }
      } catch (draftErr) {
        console.warn('⚠️ Draft table apaar_id check skipped:', draftErr.message);
      }

      // Ensure idx_spd_apaar_id exists if missing
      try {
        const [idxSpd] = await conn.query(
          'SELECT COUNT(*) as count FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = "student_personal_details" AND index_name = "idx_spd_apaar_id"'
        );
        if (Number(idxSpd?.[0]?.count || 0) === 0) {
          await conn.query('CREATE INDEX `idx_spd_apaar_id` ON `student_personal_details` (`apaar_id`)');
        }
      } catch (_) {}

      return true;
    },
    getReason: () => 'student_personal_details.apaar_id column already exists',
  },
  {
    id: 29,
    description: '0029_attendance_submission_timestamp',
    getEntries: (entries) => entries.filter((e) => e.idx === 29),
    isSatisfied: async (conn) => {
      const [sa] = await conn.query(
        'SELECT COUNT(*) as count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = "student_attendance" AND column_name = "submitted_at"'
      );
      return Number(sa?.[0]?.count || 0) > 0;
    },
    getReason: () => 'student_attendance.submitted_at column already exists',
  },
  {
    id: 30,
    description: '0030_attendance_architecture_optimization',
    getEntries: (entries) => entries.filter((e) => e.idx === 30),
    isSatisfied: async (conn) => {
      const [colAs] = await conn.query(
        'SELECT COUNT(*) as count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = "attendance_sessions" AND column_name = "total_students"'
      );
      const hasAs = Number(colAs?.[0]?.count || 0) > 0;

      const [colSa] = await conn.query(
        'SELECT COUNT(*) as count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = "student_attendance" AND column_name = "session_id"'
      );
      const hasSa = Number(colSa?.[0]?.count || 0) > 0;

      // Clean pre-migration schema: neither exists, let Drizzle run migration 0030
      if (!hasAs && !hasSa) {
        return false;
      }

      // Both already exist: fully migrated
      if (hasAs && hasSa) {
        return true;
      }

      // Partially migrated state: attendance_sessions has columns, but student_attendance pending
      if (hasAs && !hasSa) {
        console.info('ℹ️ Resolving partial migration 0030: Adding session_id to student_attendance...');
        await conn.query('ALTER TABLE `student_attendance` ADD COLUMN `session_id` int NULL');

        // Backfill session_id if records exist
        try {
          await conn.query(`
            UPDATE student_attendance sa
            JOIN attendance_sessions s
              ON sa.assignment_id = s.assignment_id
             AND sa.date = s.attendance_date
             AND sa.session = s.session_number
            SET sa.session_id = s.id
            WHERE sa.session_id IS NULL
          `);
        } catch (bfErr) {
          console.warn('⚠️ Attendance session_id backfill skipped:', bfErr.message);
        }

        // Apply remaining indexes and foreign key
        try {
          await conn.query('ALTER TABLE `student_attendance` ADD UNIQUE INDEX `uq_student_attendance` (`student_id`, `assignment_id`, `date`, `session`)');
        } catch (idxErr) {
          console.warn('⚠️ Unique index uq_student_attendance skipped:', idxErr.message);
        }

        try {
          await conn.query('ALTER TABLE `student_attendance` ADD UNIQUE INDEX `uq_session_student` (`session_id`, `student_id`)');
        } catch (idxErr) {
          console.warn('⚠️ Unique index uq_session_student skipped:', idxErr.message);
        }

        try {
          await conn.query('ALTER TABLE `student_attendance` ADD INDEX `idx_sa_student_assignment` (`student_id`, `assignment_id`)');
        } catch (idxErr) {
          console.warn('⚠️ Index idx_sa_student_assignment skipped:', idxErr.message);
        }

        try {
          await conn.query('ALTER TABLE `student_attendance` ADD INDEX `idx_sa_session_status` (`session_id`, `status`)');
        } catch (idxErr) {
          console.warn('⚠️ Index idx_sa_session_status skipped:', idxErr.message);
        }

        try {
          await conn.query('ALTER TABLE `student_attendance` ADD CONSTRAINT `fk_sa_session` FOREIGN KEY (`session_id`) REFERENCES `attendance_sessions` (`id`) ON DELETE CASCADE');
        } catch (fkErr) {
          console.warn('⚠️ Foreign key fk_sa_session skipped:', fkErr.message);
        }

        return true;
      }

      return false;
    },
    getReason: () => 'attendance_sessions and student_attendance architecture optimization verified',
  },
];

module.exports = {
  BASELINE_RULES,
};

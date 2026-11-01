import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  students, 
  studentAttendance, 
  facultySubjectAssignments, 
  academicCalendar, 
  studentInactivityLogs,
  userSessions
} from '@/db/schema';
import { eq, and, sql, gte, inArray, isNull } from 'drizzle-orm';
import { getBranchFromRoll } from '@/lib/rollNumber';
import { getCollegeAcademicYear } from '@/lib/academic-utils';

export class StudentInactivityService {
  /**
   * Scans all active students and checks for extended inactivity.
   * Rules:
   * - Absence threshold: 5 calendar months (~150 days)
   * - Warning at 4 calendar months (~120 days)
   * - Deducts declared holidays and semester breaks
   * - Cohort safeguard: requires minimum 15 total classes conducted for the cohort
   * @param {Object} options
   * @param {boolean} [options.dryRun=false]
   */
  static async scanAndProcessInactivity({ dryRun = false } = {}) {
    const academicYear = await getCollegeAcademicYear();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // 1. Fetch all currently ACTIVE students
    const activeStudents = await db.select({
      id: students.id,
      roll_no: students.roll_no,
      name: students.name,
      email: students.email,
      admission_date: students.admission_date
    })
    .from(students)
    .where(eq(students.student_status, 'ACTIVE'));

    const results = {
      scanned: activeStudents.length,
      warned: 0,
      deactivated: 0,
      skippedCohortSafeguard: 0,
      details: []
    };

    // Pre-calculate holiday dates count in last 180 days to deduct non-working periods accurately
    const sixMonthsAgo = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000);
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

    const holidays = await db.select({ date: academicCalendar.date })
      .from(academicCalendar)
      .where(and(
        gte(academicCalendar.date, sixMonthsAgoStr),
        eq(academicCalendar.day_type, 'HOLIDAY')
      ));
    const holidayDatesSet = new Set(holidays.map(h => {
      return h.date instanceof Date ? h.date.toISOString().split('T')[0] : String(h.date);
    }));

    for (const student of activeStudents) {
      const branch = getBranchFromRoll(student.roll_no);
      if (!branch) continue;

      // 2. Fetch last qualifying attendance date (PRESENT, NCC, MEDICAL)
      const lastAttRows = await db.select({
        maxDate: sql`MAX(${studentAttendance.date})`
      })
      .from(studentAttendance)
      .where(and(
        eq(studentAttendance.student_id, student.id),
        inArray(studentAttendance.status, ['PRESENT', 'NCC', 'MEDICAL'])
      ));

      let lastDate = lastAttRows[0]?.maxDate;
      if (!lastDate) {
        // If no attendance ever recorded, baseline against admission_date or 6 months ago
        lastDate = student.admission_date || sixMonthsAgoStr;
      }

      const lastDateObj = new Date(lastDate);
      const diffMs = today.getTime() - lastDateObj.getTime();
      const rawDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

      // 3. Deduct holidays that fell between last attendance and today
      let holidayCount = 0;
      for (const hDate of holidayDatesSet) {
        if (hDate >= (lastDateObj.toISOString().split('T')[0]) && hDate <= todayStr) {
          holidayCount++;
        }
      }

      const netInactivityDays = Math.max(0, rawDays - holidayCount);

      // 4. Cohort Safeguard: Check how many total class sessions were conducted for this student's branch
      // during their period of inactivity. If fewer than 15 classes were held, do not penalize the student!
      const sessionsConductedRows = await db.select({
        totalSessions: sql`COUNT(DISTINCT ${studentAttendance.id})`
      })
      .from(studentAttendance)
      .innerJoin(facultySubjectAssignments, eq(studentAttendance.assignment_id, facultySubjectAssignments.id))
      .where(and(
        eq(facultySubjectAssignments.branch, branch),
        gte(studentAttendance.date, lastDate)
      ));

      const totalCohortSessions = Number(sessionsConductedRows[0]?.totalSessions || 0);
      if (totalCohortSessions < 15 && netInactivityDays >= 120) {
        results.skippedCohortSafeguard++;
        continue;
      }

      // 5. Evaluate thresholds
      // 5 calendar months = ~150 net days
      // 4 calendar months = ~120 net days (warning)
      if (netInactivityDays >= 150) {
        results.deactivated++;
        results.details.push({
          student_id: student.id,
          roll_no: student.roll_no,
          action: 'DEACTIVATED',
          netInactivityDays,
          lastAttendance: lastDate
        });

        if (!dryRun) {
          // Deactivate student
          await db.update(students)
            .set({ 
              student_status: 'INACTIVE_ATTENDANCE',
              updated_at: new Date()
            })
            .where(eq(students.id, student.id));

          // Revoke active sessions
          await db.update(userSessions)
            .set({ revoked_at: new Date() })
            .where(and(
              eq(userSessions.user_id, student.id),
              eq(userSessions.user_type, 'student'),
              isNull(userSessions.revoked_at)
            ));

          // Log deactivation
          await db.insert(studentInactivityLogs).values({
            student_id: student.id,
            academic_year: academicYear || '2025-26',
            last_attendance_date: lastDate instanceof Date ? lastDate : new Date(lastDate),
            inactivity_days: netInactivityDays,
            action_taken: 'DEACTIVATED',
            remarks: `Automatically deactivated due to ${netInactivityDays} days consecutive absence (5+ calendar months).`
          });
        }
      } else if (netInactivityDays >= 120) {
        // Check if warning already logged in last 45 days
        const recentWarning = await db.query.studentInactivityLogs.findFirst({
          where: and(
            eq(studentInactivityLogs.student_id, student.id),
            eq(studentInactivityLogs.action_taken, 'WARNING_SENT'),
            gte(studentInactivityLogs.created_at, new Date(today.getTime() - 45 * 24 * 60 * 60 * 1000))
          )
        });

        if (!recentWarning) {
          results.warned++;
          results.details.push({
            student_id: student.id,
            roll_no: student.roll_no,
            action: 'WARNING_SENT',
            netInactivityDays,
            lastAttendance: lastDate
          });

          if (!dryRun) {
            await db.insert(studentInactivityLogs).values({
              student_id: student.id,
              academic_year: academicYear || '2025-26',
              last_attendance_date: lastDate instanceof Date ? lastDate : new Date(lastDate),
              inactivity_days: netInactivityDays,
              action_taken: 'WARNING_SENT',
              remarks: `Warning issued: ${netInactivityDays} days consecutive absence. Account deactivation will occur after 30-day grace period if unaddressed.`
            });
          }
        }
      }
    }

    logger.info({ results, dryRun }, '[STUDENT_INACTIVITY_SCAN_COMPLETED]');
    return results;
  }
}

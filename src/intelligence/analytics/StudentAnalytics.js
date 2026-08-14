import { db } from '@/db';
import { 
  studentAttendance, 
  studentMarks, 
  facultySubjectAssignments 
} from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { cacheAside } from '@/lib/cache';

export class StudentAnalytics {
  static async getAttendanceTrend(...args) { return new StudentAnalytics().getAttendanceTrend(...args); }
  static async getMarksTrend(...args) { return new StudentAnalytics().getMarksTrend(...args); }
  static async getSemesterComparison(...args) { return new StudentAnalytics().getSemesterComparison(...args); }
  static async getSubjectPerformance(...args) { return new StudentAnalytics().getSubjectPerformance(...args); }
  static async getStudentSummary(...args) { return new StudentAnalytics().getStudentSummary(...args); }


  async getAttendanceTrend(studentId, filters = {}) {
    return await cacheAside(
      `analytics:student:${studentId}:attendance_trend:${JSON.stringify(filters)}`,
      async () => {
        // Mocked query structure based on standard SQL grouping by week
        const result = await db.select({
          week: sql`WEEK(${studentAttendance.date})`,
          present: sql`SUM(CASE WHEN ${studentAttendance.status} = 'PRESENT' THEN 1 ELSE 0 END)`,
          total: sql`COUNT(*)`
        })
        .from(studentAttendance)
        .where(eq(studentAttendance.student_id, studentId))
        .groupBy(sql`WEEK(${studentAttendance.date})`)
        .orderBy(sql`WEEK(${studentAttendance.date})`);
        
        return result.map(r => ({
          week: r.week,
          percentage: r.total > 0 ? (r.present / r.total) * 100 : 0
        }));
      },
      { ttl: 300, tags: ['intelligence'] }
    );
  }

  async getMarksTrend(studentId, filters = {}) {
    return await cacheAside(
      `analytics:student:${studentId}:marks_trend:${JSON.stringify(filters)}`,
      async () => {
        const result = await db.select({
          subjectName: facultySubjectAssignments.subject_name,
          mid1: studentMarks.mid1_marks,
          mid2: studentMarks.mid2_marks,
          assignment: studentMarks.assignment_marks
        })
        .from(studentMarks)
        .innerJoin(facultySubjectAssignments, eq(studentMarks.assignment_id, facultySubjectAssignments.id))
        .where(eq(studentMarks.student_id, studentId));
        return result;
      },
      { ttl: 300, tags: ['intelligence'] }
    );
  }

  async getSemesterComparison(studentId) {
    return await cacheAside(
      `analytics:student:${studentId}:semester_comp`,
      async () => {
        const result = await db.select({
          semester: facultySubjectAssignments.course_semester,
          avgMid1: sql`AVG(${studentMarks.mid1_marks})`,
          avgMid2: sql`AVG(${studentMarks.mid2_marks})`
        })
        .from(studentMarks)
        .innerJoin(facultySubjectAssignments, eq(studentMarks.assignment_id, facultySubjectAssignments.id))
        .where(eq(studentMarks.student_id, studentId))
        .groupBy(facultySubjectAssignments.course_semester);
        return result;
      },
      { ttl: 300, tags: ['intelligence'] }
    );
  }

  async getSubjectPerformance(studentId, filters = {}) {
    return this.getMarksTrend(studentId, filters); // Simplified for this exercise
  }

  async getStudentSummary(studentId, academicYear) {
    return await cacheAside(
      `analytics:student:${studentId}:summary:${academicYear}`,
      async () => {
        const attendance = await this.getAttendanceTrend(studentId, { academicYear });
        const marks = await this.getMarksTrend(studentId, { academicYear });
        return { attendance, marks };
      },
      { ttl: 300, tags: ['intelligence'] }
    );
  }
}

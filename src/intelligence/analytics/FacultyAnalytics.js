import { db } from '@/db';
import { 
  attendanceSessions, 
  facultySubjectAssignments, 
  studentMarks 
} from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { cacheAside } from '@/lib/cache';

export class FacultyAnalytics {
  async getAttendanceSubmissionRate(facultyId, filters = {}) {
    return await cacheAside(
      `analytics:faculty:${facultyId}:attendance_rate:${JSON.stringify(filters)}`,
      async () => {
        const result = await db.select({
          totalSessions: sql`COUNT(*)`,
          subjectId: attendanceSessions.assignment_id
        })
        .from(attendanceSessions)
        .where(eq(attendanceSessions.faculty_id, facultyId))
        .groupBy(attendanceSessions.assignment_id);
        return result;
      },
      { ttl: 300, tags: ['intelligence'] }
    );
  }

  async getTopicCompletionStats(facultyId, filters = {}) {
    return await cacheAside(
      `analytics:faculty:${facultyId}:topics:${JSON.stringify(filters)}`,
      async () => {
        const result = await db.select({
          subjectName: facultySubjectAssignments.subject_name,
          topicsCovered: sql`COUNT(DISTINCT ${attendanceSessions.topic_covered})`
        })
        .from(attendanceSessions)
        .innerJoin(facultySubjectAssignments, eq(attendanceSessions.assignment_id, facultySubjectAssignments.id))
        .where(eq(attendanceSessions.faculty_id, facultyId))
        .groupBy(facultySubjectAssignments.subject_name);
        return result;
      },
      { ttl: 300, tags: ['intelligence'] }
    );
  }

  async getStudentPerformanceForFaculty(facultyId, filters = {}) {
    return await cacheAside(
      `analytics:faculty:${facultyId}:student_perf:${JSON.stringify(filters)}`,
      async () => {
        const result = await db.select({
          subjectName: facultySubjectAssignments.subject_name,
          avgTotalMarks: sql`AVG(${studentMarks.mid1_marks} + ${studentMarks.mid2_marks})`
        })
        .from(studentMarks)
        .innerJoin(facultySubjectAssignments, eq(studentMarks.assignment_id, facultySubjectAssignments.id))
        .where(eq(facultySubjectAssignments.faculty_id, facultyId))
        .groupBy(facultySubjectAssignments.subject_name);
        return result;
      },
      { ttl: 300, tags: ['intelligence'] }
    );
  }

  async getWorkloadDistribution(filters = {}) {
    return await cacheAside(
      `analytics:faculty:workload:${JSON.stringify(filters)}`,
      async () => {
        const result = await db.select({
          facultyId: facultySubjectAssignments.faculty_id,
          subjectCount: sql`COUNT(*)`
        })
        .from(facultySubjectAssignments)
        .where(eq(facultySubjectAssignments.is_active, true))
        .groupBy(facultySubjectAssignments.faculty_id);
        return result;
      },
      { ttl: 300, tags: ['intelligence'] }
    );
  }
}

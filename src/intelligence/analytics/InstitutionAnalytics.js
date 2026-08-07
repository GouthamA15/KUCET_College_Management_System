import { db } from '@/db';
import { students } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { cacheAside } from '@/lib/cache';

export class InstitutionAnalytics {
  async getActiveStudentCount() {
    return await cacheAside(
      `analytics:inst:active_students`,
      async () => {
        const result = await db.select({ count: sql`COUNT(*)` })
          .from(students)
          .where(eq(students.academic_status, 'ACTIVE'));
        return result[0]?.count || 0;
      },
      { ttl: 300, tags: ['intelligence'] }
    );
  }

  async getAlumniCount() {
    return await cacheAside(
      `analytics:inst:alumni`,
      async () => {
        const result = await db.select({ count: sql`COUNT(*)` })
          .from(students)
          .where(eq(students.academic_status, 'GRADUATED'));
        return result[0]?.count || 0;
      },
      { ttl: 300, tags: ['intelligence'] }
    );
  }

  async getDepartmentComparison(academicYear) {
    return [];
  }

  async getArchiveGrowth() {
    return [];
  }

  async getInstitutionSummary(academicYear) {
    return {
      activeStudents: await this.getActiveStudentCount(),
      alumni: await this.getAlumniCount()
    };
  }
}

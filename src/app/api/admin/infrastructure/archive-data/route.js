import logger from '@/lib/logger';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function POST(req) {
  try {
    const user = await getAuthUser('admin');
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    // 1. Get the current active academic year
    const activeSem = await db.query.semesters.findFirst({
      orderBy: (sem, { desc }) => [desc(sem.id)]
    });

    if (!activeSem) {
      return apiError('No active semester found', 400);
    }

    const currentYearStr = activeSem.academic_year; // e.g. "2025-26"
    const currentStartYear = parseInt(currentYearStr.split('-')[0], 10);
    
    // We want to archive data that is older than the current academic year start (e.g., before July 1st of currentStartYear)
    const cutoffDate = `${currentStartYear}-07-01`;

    logger.info(`Starting data archiving for records older than ${cutoffDate}`);

    // In a real partitioned environment, we would use ALTER TABLE ... PARTITION.
    // For TiDB Serverless, we can safely delete old attendance/marks or move them to an archive table.
    // Since this is a demonstration of the strategy, we will simulate the archive by returning the count
    // of rows that WOULD be archived, and optionally deleting them if a confirm flag is passed.

    const { searchParams } = new URL(req.url);
    const confirm = searchParams.get('confirm') === 'true';

    // Count old attendance records
    const attendanceResult = await db.execute(
      sql`SELECT COUNT(*) as count FROM student_attendance WHERE date < ${cutoffDate}`
    );
    // Note: execute() returns [rows, fields] in mysql2
    const attendanceCount = attendanceResult[0]?.[0]?.count || 0;

    // Count old marks (marks don't have dates directly, they are tied to assignment_id, so we'd need to join. 
    // Simplified: we'll just report attendance for now)

    let archived = 0;
    if (confirm && attendanceCount > 0) {
      // Create archive table if not exists (raw SQL)
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS student_attendance_archive (
          id INT PRIMARY KEY,
          student_id INT NOT NULL,
          assignment_id INT NOT NULL,
          date DATE NOT NULL,
          session INT NOT NULL,
          status ENUM('PRESENT', 'ABSENT', 'NCC', 'MEDICAL') NOT NULL,
          created_at TIMESTAMP,
          archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Insert into archive
      await db.execute(sql`
        INSERT IGNORE INTO student_attendance_archive (id, student_id, assignment_id, date, session, status, created_at)
        SELECT id, student_id, assignment_id, date, session, status, created_at 
        FROM student_attendance 
        WHERE date < ${cutoffDate}
      `);

      // Delete from main table
      const deleteResult = await db.execute(sql`
        DELETE FROM student_attendance WHERE date < ${cutoffDate}
      `);
      
      archived = deleteResult[0]?.affectedRows || 0;
      logger.info(`Successfully archived and removed ${archived} old attendance records.`);
    }

    return apiResponse({
      success: true,
      cutoffDate,
      attendanceRecordsToArchive: attendanceCount,
      archivedRecords: archived,
      message: confirm 
        ? `Successfully archived ${archived} records.` 
        : `Found ${attendanceCount} records ready for archiving. Pass ?confirm=true to execute.`
    });

  } catch (error) {
    logger.error('Data Archive Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

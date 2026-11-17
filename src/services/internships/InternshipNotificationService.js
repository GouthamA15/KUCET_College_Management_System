import { db } from '@/db';
import { securityNotifications } from '@/db/schema';
import { CoordinatorAssignmentService } from '@/services/identity/CoordinatorAssignmentService';
import logger from '@/lib/logger';

export class InternshipNotificationService {
  /**
   * Notifies an individual student with an in-app security notification.
   */
  static async notifyStudent({ studentId, title, message, severity = 'INFO' }) {
    try {
      const sId = Number(studentId);
      if (!sId) return;

      await db.insert(securityNotifications).values({
        user_type: 'STUDENT',
        user_id: sId,
        title,
        message,
        severity,
        is_read: false,
        created_at: new Date(),
      });

      logger.info({ studentId: sId, title }, '[INTERNSHIP_STUDENT_NOTIFIED]');
    } catch (err) {
      logger.error({ err: err.message, studentId }, '[NOTIFY_STUDENT_INTERNSHIP_ERROR]');
    }
  }

  /**
   * Notifies the currently active designated Internship Coordinator.
   */
  static async notifyCoordinator({ title, message, severity = 'INFO' }) {
    try {
      const activeCoordinator = await CoordinatorAssignmentService.getActiveInternshipCoordinator();
      if (!activeCoordinator?.staff_id) {
        logger.warn('[INTERNSHIP_NOTIFICATION_NO_ACTIVE_COORDINATOR]');
        return;
      }

      const staffId = Number(activeCoordinator.staff_id);

      await db.insert(securityNotifications).values({
        user_type: 'STAFF',
        user_id: staffId,
        title,
        message,
        severity,
        is_read: false,
        created_at: new Date(),
      });

      logger.info({ coordinatorStaffId: staffId, title }, '[INTERNSHIP_COORDINATOR_NOTIFIED]');
    } catch (err) {
      logger.error({ err: err.message }, '[NOTIFY_COORDINATOR_INTERNSHIP_ERROR]');
    }
  }
}

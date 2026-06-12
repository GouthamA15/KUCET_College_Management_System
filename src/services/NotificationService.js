import { broadcastUpdate } from '@/lib/sse';
import { sendInstitutionalEmail } from '@/lib/email';
import logger from '@/lib/logger';

/**
 * Unified Notification Engine
 * Abstracts Realtime (Toasts), Email, and future SMS delivery to ensure
 * a consistent, multi-channel notification experience across the application.
 */
export class NotificationService {
  /**
   * Send an instant real-time toast to the UI via WebSockets
   */
  static async sendRealtime(event, payload) {
    try {
      await broadcastUpdate(event, payload);
    } catch (error) {
      logger.error(error, '[NOTIFICATION_ENGINE] Realtime Broadcast Failed');
    }
  }

  /**
   * Send an institutional email
   */
  static async sendEmail(to, subject, title, bodyHtml, infoRows = []) {
    try {
      await sendInstitutionalEmail({
        to,
        subject,
        title,
        bodyHtml,
        infoRows
      });
    } catch (error) {
      logger.error(error, '[NOTIFICATION_ENGINE] Email Delivery Failed');
    }
  }

  /**
   * Stub for future SMS implementation (e.g., using Twilio, Fast2SMS)
   */
  static async sendSMS(phone, message) {
    try {
      // Mock SMS delivery for now
      logger.info({ phone, message }, '[NOTIFICATION_ENGINE] Mock SMS sent');
    } catch (error) {
      logger.error(error, '[NOTIFICATION_ENGINE] SMS Delivery Failed');
    }
  }

  // ============================================================================
  // ONE-LINE INSTITUTIONAL NOTIFICATION TRIGGERS
  // ============================================================================

  /**
   * Notify a student that their certificate is approved and ready for download.
   */
  static async notifyCertificateReady(student, certificateType) {
    // 1. Instant Toast
    await this.sendRealtime('REQUEST_UPDATED', {
      student_id: student.id,
      certificate_type: certificateType,
      status: 'APPROVED'
    });

    // 2. Email
    if (student.email && student.is_email_verified) {
      await this.sendEmail(
        student.email,
        `${certificateType} Approved`,
        'Certificate Ready for Download',
        `<p>Dear ${student.name},</p><p>Your request for a <strong>${certificateType}</strong> has been approved. You can now download it directly from your dashboard.</p>`,
        [{ label: 'Certificate', value: certificateType }, { label: 'Status', value: 'Approved & Digitally Signed' }]
      );
    }

    // 3. SMS (Future)
    if (student.mobile) {
      await this.sendSMS(student.mobile, `KUCET: Your ${certificateType} is approved and ready for download in your portal.`);
    }
  }

  /**
   * Notify a student that their fee payment has been successfully recorded.
   */
  static async notifyFeePaymentRecorded(student, amount, academicYear) {
    await this.sendRealtime('PAYMENT_RECORDED', {
      student_id: student.id,
      amount: amount,
      academic_year: academicYear
    });

    if (student.email && student.is_email_verified) {
      await this.sendEmail(
        student.email,
        `Fee Payment Receipt Recorded`,
        'Payment Verified',
        `<p>Dear ${student.name},</p><p>We have successfully verified and recorded a fee payment of <strong>₹${Number(amount).toLocaleString()}</strong> for the academic year ${academicYear}.</p>`,
        [{ label: 'Amount', value: `₹${Number(amount).toLocaleString()}` }, { label: 'Year', value: academicYear }]
      );
    }
  }

  /**
   * Notify a student that their scholarship sanction has been processed.
   */
  static async notifyScholarshipSanctioned(student, amount, academicYear) {
    await this.sendRealtime('SCHOLARSHIP_SANCTIONED', {
      student_id: student.id,
      academic_year: academicYear,
      amount: amount
    });

    // We can skip email here if it's too noisy, but we have the capability if requested.
  }
}

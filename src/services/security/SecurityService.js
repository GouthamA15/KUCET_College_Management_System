import { db } from '@/db';
import { 
  securityEvents, 
  securityNotifications, 
  userSessions,
  students,
  staffAccounts,
  principal
} from '@/db/schema';
import { eq, and, ne, sql, desc } from 'drizzle-orm';
import { broadcastUpdate } from '@/lib/sse';
import logger from '@/lib/logger';
import { getNow } from '@/lib/clock';
import { parseUA } from '@/lib/ua-parser';
import { sendInstitutionalEmail, getBaseUrl } from '@/lib/email';
import { formatInstitutionalDateTime } from '@/lib/date';
import crypto from 'crypto';

/**
 * Service to handle all security-related operations
 */
export class SecurityService {
  /**
   * Alias for logEvent to support legacy calls
   */
  static async logSecurityEvent(params) {
    return this.logEvent(params);
  }

  /**
   * Log a security event
   */
  static async logEvent({ userType, userId, eventType, ipAddress, details = {} }) {
    try {
      const upperType = userType ? userType.toUpperCase() : '';
      if (upperType === 'STUDENT') {
        const allowed = ['LOGIN_SUCCESS', 'PASSWORD_CHANGED', 'PASSWORD_CREATED', 'EMAIL_CHANGED', 'EMAIL_VERIFIED'];
        if (!allowed.includes(eventType)) {
          return;
        }
      }
      await db.insert(securityEvents).values({
        user_type: upperType,
        user_id: userId,
        event_type: eventType,
        ip_address: ipAddress,
        details,
        created_at: new Date(), // Use real UTC for DB storage; getNow() is IST display-only
      });
      logger.info({ userType, userId, eventType }, '[SECURITY_EVENT_LOGGED]');

      // Trigger email for critical events
      const criticalEvents = [
        'NEW_DEVICE_LOGIN', 'PASSWORD_CHANGED', 
        'EMAIL_CHANGED', 'SESSION_REVOKED', 'OTHER_SESSIONS_REVOKED'
      ];
      if (criticalEvents.includes(eventType)) {
        // Send email in background
        this.sendSecurityEmail(eventType, userId, userType, details, ipAddress).catch(err => {
          logger.error(err, '[SECURITY_EMAIL_BACKGROUND_FAILED]');
        });
      }
    } catch (err) {
      logger.error(err, '[SECURITY_EVENT_LOG_FAILED]');
    }
  }

  /**
   * Send security email alert
   */
  static async sendSecurityEmail(eventType, userId, userType, details, ipAddress) {
    try {
      let userEmail, userName;
      if (userType.toUpperCase() === 'STUDENT') {
        const user = await db.query.students.findFirst({
          where: eq(students.id, userId),
          columns: { email: true, name: true }
        });
        userEmail = user?.email;
        userName = user?.name;
      } else if (userType.toUpperCase() === 'STAFF') {
        const user = await db.query.staffAccounts.findFirst({
          where: eq(staffAccounts.id, userId),
          columns: { email: true, name: true }
        });
        userEmail = user?.email;
        userName = user?.name;
      } else if (userType.toUpperCase() === 'ADMIN') {
        const user = await db.query.principal.findFirst({
          where: eq(principal.id, userId),
          columns: { email: true }
        });
        userEmail = user?.email;
        userName = 'Administrator';
      }

      if (!userEmail) return;

      let title, subject, bodyHtml;
      const deviceInfo = details.browser ? `${details.browser} on ${details.operatingSystem || details.operating_system || 'Unknown OS'}` : 'Unknown device';
      const timeStr = formatInstitutionalDateTime(getNow());

      switch (eventType) {
        case 'NEW_DEVICE_LOGIN':
          subject = '⚠ Security Alert: New Device Login';
          title = 'New Device Detected';
          bodyHtml = `<p>Hello ${userName},</p><p>A new device has just signed into your KUCET account. If this was you, you can safely ignore this email.</p>`;
          break;
        case 'PASSWORD_CHANGED':
        case 'PASSWORD_CREATED':
          subject = '🔐 Security Alert: Password Updated';
          title = 'Password Securely Updated';
          bodyHtml = `<p>Hello ${userName},</p><p>Your account password was recently updated. If you did not make this change, please contact support immediately.</p>`;
          break;
        case 'EMAIL_CHANGED':
        case 'EMAIL_VERIFIED':
          subject = '📧 Security Alert: Email Updated';
          title = 'Email Address Verified';
          bodyHtml = `<p>Hello ${userName},</p><p>Your account email address was recently verified and updated. If you did not make this change, please contact support immediately.</p>`;
          break;
        case 'SESSION_REVOKED':
          subject = '🔒 Security Alert: Session Terminated';
          title = 'Session Revoked';
          bodyHtml = `<p>Hello ${userName},</p><p>An active session on your account was terminated (logged out remotely). If you didn't do this, your account might be compromised.</p>`;
          break;
        case 'OTHER_SESSIONS_REVOKED':
          subject = '🔒 Security Alert: Multiple Sessions Terminated';
          title = 'Sessions Revoked';
          bodyHtml = `<p>Hello ${userName},</p><p>All other active sessions on your account were terminated. If you didn't do this, please secure your account immediately.</p>`;
          break;
        default:
          return;
      }

      await sendInstitutionalEmail({
        to: userEmail,
        subject,
        title,
        bodyHtml,
        infoRows: [
          { label: 'Event', value: eventType.replace(/_/g, ' ') },
          { label: 'Device', value: deviceInfo },
          { label: 'IP Address', value: ipAddress || 'Unknown' },
          { label: 'Time', value: timeStr }
        ],
        action: {
          label: 'Visit Security Center',
          url: `${getBaseUrl()}/${userType.toUpperCase()}/settings/security`
        }
      });
    } catch (err) {
      logger.error(err, '[SEND_SECURITY_EMAIL_FAILED]');
    }
  }

  /**
   * Update last login info in user tables
   */
  static async updateLastLogin(userType, userId, ipAddress) {
    try {
      const now = getNow();
      const safeIp = ipAddress || 'unknown';
      
      if (!(now instanceof Date)) {
        throw new Error('getNow() did not return a Date object');
      }

      const upperType = userType.toUpperCase();
      const updatePayload = {
        last_login_at: now,
        last_login_ip: safeIp
      };

      let result;
      if (upperType === 'STUDENT') {
        [result] = await db.update(students).set(updatePayload).where(eq(students.id, userId));
      } else if (upperType === 'STAFF') {
        [result] = await db.update(staffAccounts).set(updatePayload).where(eq(staffAccounts.id, userId));
      } else if (upperType === 'ADMIN') {
        [result] = await db.update(principal).set(updatePayload).where(eq(principal.id, userId));
      }
      
      const affectedRows = result?.affectedRows ?? 0;
      if (affectedRows === 0) {
        logger.warn({ userType: upperType, userId }, '[LAST_LOGIN_NOT_FOUND] No rows updated');
      } else {
        logger.info({ userType: upperType, userId, ip: safeIp, affectedRows }, '[LAST_LOGIN_UPDATED]');
      }
    } catch (err) {
      logger.error({ err: err.message, userType, userId }, '[UPDATE_LAST_LOGIN_FAILED]');
    }
  }

  /**
   * Create a security notification
   */
  static async createNotification({ userType, userId, title, message, severity = 'INFO' }) {
    try {
      const upperType = userType ? userType.toUpperCase() : '';
      if (upperType === 'STUDENT') {
        return;
      }
      await db.insert(securityNotifications).values({
        user_type: userType.toUpperCase(),
        user_id: userId,
        title,
        message,
        severity,
        created_at: new Date(), // Use real UTC for DB storage; getNow() is IST display-only
      });
      
      // Real-time broadcast for notification count update
      await broadcastUpdate('SECURITY_NOTIFICATION_CREATED', {
        userId,
        userType: userType.toUpperCase(),
        title,
        severity
      });

      logger.info({ userType, userId, title }, '[SECURITY_NOTIFICATION_CREATED]');
    } catch (err) {
      logger.error(err, '[SECURITY_NOTIFICATION_FAILED]');
    }
  }

  /**
   * Get active sessions for a user
   */
  static async getActiveSessions(userType, userId, currentTokenHash = null) {
    try {
      const now = getNow();
      const sessions = await db
        .select()
        .from(userSessions)
        .where(and(
          eq(userSessions.user_id, userId),
          eq(userSessions.user_type, userType.toUpperCase()),
          eq(userSessions.is_revoked, false),
          sql`${userSessions.expires_at} > ${now}`
        ))
        .orderBy(desc(userSessions.last_seen_at));

      return sessions.map(s => ({
        id: s.id,
        deviceName: s.device_name,
        browser: s.browser,
        os: s.operating_system,
        ip: s.ip_address,
        location: s.location,
        isCurrent: currentTokenHash ? s.session_token_hash === currentTokenHash : s.is_current,
        lastSeen: s.last_seen_at,
        createdAt: s.created_at
      }));
    } catch (err) {
      logger.error(err, '[GET_ACTIVE_SESSIONS_FAILED]');
      return [];
    }
  }

  /**
   * Revoke a specific session.
   * @param {Object} options
   * @param {string} options.userType - User role (STUDENT, STAFF, ADMIN, etc.)
   * @param {number} options.userId  - User's primary key
   * @param {number} options.sessionId - Session ID to revoke
   */
  static async revokeSession({ userType, userId, sessionId }) {
    userType = userType.toUpperCase();

    try {
      const [session] = await db
        .select()
        .from(userSessions)
        .where(and(
          eq(userSessions.id, sessionId),
          eq(userSessions.user_id, userId),
          eq(userSessions.user_type, userType)
        ))
        .limit(1);

      if (!session) {
        throw new Error('Session not found');
      }

      await db
        .update(userSessions)
        .set({ is_revoked: true, is_current: false })
        .where(eq(userSessions.id, sessionId));

      // Log event (will trigger email)
      await this.logEvent({
        userType,
        userId,
        eventType: 'SESSION_REVOKED',
        details: { sessionId, browser: session.browser, operating_system: session.operating_system }
      });

      // Notify
      await this.createNotification({
        userType,
        userId,
        title: '🔒 Session Revoked',
        message: `Your session on ${session.device_name || 'unknown device'} (${session.browser || 'unknown browser'}) was terminated.`,
        severity: 'WARNING'
      });

      // Broadcast to client
      await broadcastUpdate('SESSION_REVOKED', {
        sessionId,
        userId,
        userType,
        timestamp: Date.now()
      });

      return true;
    } catch (err) {
      logger.error(err, '[SESSION_REVOCATION_FAILED]');
      return false;
    }
  }

  /**
   * Revoke all sessions for a user except the current one.
   * @param {Object} options
   * @param {string} options.userType        - User role
   * @param {number} options.userId          - User's primary key
   * @param {string} [options.currentTokenHash] - Hash of the token to keep alive
   * @param {number} [options.currentSessionId] - ID of the session to keep alive (fallback)
   */
  static async revokeOtherSessions({ userType, userId, currentTokenHash, currentSessionId }) {
    userType = userType.toUpperCase();

    try {
      const whereClause = [
        eq(userSessions.user_id, userId),
        eq(userSessions.user_type, userType),
        eq(userSessions.is_revoked, false)
      ];

      if (currentTokenHash) {
        whereClause.push(ne(userSessions.session_token_hash, currentTokenHash));
      } else if (currentSessionId) {
        whereClause.push(ne(userSessions.id, currentSessionId));
      }

      const otherSessions = await db
        .select()
        .from(userSessions)
        .where(and(...whereClause));

      if (otherSessions.length === 0) return true;

      await db
        .update(userSessions)
        .set({ is_revoked: true, is_current: false })
        .where(and(...whereClause));

      // Log event (will trigger email)
      await this.logEvent({
        userType,
        userId,
        eventType: 'OTHER_SESSIONS_REVOKED',
        details: { count: otherSessions.length }
      });

      // Notify
      await this.createNotification({
        userType,
        userId,
        title: '🔒 Other Sessions Revoked',
        message: `${otherSessions.length} other active session(s) were terminated.`,
        severity: 'INFO'
      });

      // Broadcast to each session
      for (const session of otherSessions) {
        await broadcastUpdate('SESSION_REVOKED', {
          sessionId: session.id,
          userId,
          userType,
          timestamp: Date.now()
        });
      }

      return true;
    } catch (err) {
      logger.error(err, '[OTHER_SESSIONS_REVOCATION_FAILED]');
      return false;
    }
  }

  /**
   * Detect new device and log it
   */
  static async detectNewDevice(userId, userType, deviceInfo, ipAddress) {
    try {
      const upperType = userType ? userType.toUpperCase() : '';
      if (upperType === 'STUDENT') {
        return false;
      }
      const { browser, operatingSystem } = deviceInfo;

      // Check for existing sessions with similar characteristics
      const existingSessions = await db
        .select()
        .from(userSessions)
        .where(and(
          eq(userSessions.user_id, userId),
          eq(userSessions.user_type, userType.toUpperCase()),
          eq(userSessions.browser, browser),
          eq(userSessions.operating_system, operatingSystem)
        ))
        .limit(1);

      if (existingSessions.length === 0) {
        // New device detected (this will trigger email via logEvent)
        await this.logEvent({
          userType,
          userId,
          eventType: 'NEW_DEVICE_LOGIN',
          ipAddress,
          details: deviceInfo
        });

        await this.createNotification({
          userType,
          userId,
          title: '⚠ New Device Login',
          message: `A new login was detected from ${deviceInfo.deviceName || 'a new device'} using ${browser} on ${operatingSystem}.`,
          severity: 'WARNING'
        });
        
        return true;
      }
      return false;
    } catch (err) {
      logger.error(err, '[NEW_DEVICE_DETECTION_FAILED]');
      return false;
    }
  }

  /**
   * Register a new session
   */
  static async registerSession({ userId, userType, sessionToken, ipAddress, userAgent, expiresAt }) {
    try {
      const upperType = userType ? userType.toUpperCase() : '';
      if (upperType === 'STUDENT') {
        return null;
      }
      const deviceInfo = parseUA(userAgent);
      const sessionTokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');

      // Detect if this is a new device for the user
      await this.detectNewDevice(userId, userType, deviceInfo, ipAddress);

      // Mark other sessions as not current
      await db
        .update(userSessions)
        .set({ is_current: false })
        .where(and(
          eq(userSessions.user_id, userId),
          eq(userSessions.user_type, userType.toUpperCase())
        ));

      const createdAt = getNow();
      const lastSeenAt = getNow();
      const expiryDate = expiresAt ? new Date(expiresAt) : new Date(getNow().getTime() + 30 * 24 * 60 * 60 * 1000);

      logger.info('[SESSION_REGISTRATION_TYPES]', {
        createdAtIsDate: createdAt instanceof Date,
        lastSeenAtIsDate: lastSeenAt instanceof Date,
        expiryDateIsDate: expiryDate instanceof Date,
        expiresAtRaw: typeof expiresAt
      });

      const [result] = await db.insert(userSessions).values({
        user_id: userId,
        user_type: userType.toUpperCase(),
        session_token_hash: sessionTokenHash,
        browser: deviceInfo.browser,
        operating_system: deviceInfo.operatingSystem,
        device_name: deviceInfo.deviceName,
        ip_address: ipAddress,
        location: 'Unknown',
        is_current: true,
        is_revoked: false,
        last_seen_at: lastSeenAt,
        created_at: createdAt,
        expires_at: expiryDate,
      });

      return result.insertId;
    } catch (err) {
      logger.error(err, '[SESSION_REGISTRATION_FAILED]');
      throw new Error('Failed to register user session');
    }
  }

  /**
   * Update an existing session with a new token hash and activity info
   */
  static async updateSession({ sessionId, newToken, ipAddress, userAgent, expiresAt, userId, userType }) {
    try {
      const upperType = userType ? userType.toUpperCase() : '';
      if (upperType === 'STUDENT') {
        return false;
      }
      const deviceInfo = parseUA(userAgent);
      const sessionTokenHash = crypto.createHash('sha256').update(newToken).digest('hex');
      const lastSeenAt = getNow();
      const expiryDate = expiresAt ? new Date(expiresAt) : new Date(getNow().getTime() + 30 * 24 * 60 * 60 * 1000);

      // Ensure session exists and ownership matches
      const [session] = await db
        .select({ 
          user_id: userSessions.user_id, 
          user_type: userSessions.user_type,
          is_revoked: userSessions.is_revoked 
        })
        .from(userSessions)
        .where(eq(userSessions.id, sessionId))
        .limit(1);

      if (session && session.is_revoked) {
        logger.warn({ sessionId, userId, userType }, '[SESSION_REACTIVATION_ATTEMPT] Rejected revoked session update');
        return false;
      }

      if (session && userId !== undefined && userType !== undefined) {
        if (Number(session.user_id) !== Number(userId) || session.user_type !== userType.toUpperCase()) {
          logger.warn({ sessionId, userId, userType, dbUserId: session.user_id, dbUserType: session.user_type }, '[SESSION_OWNERSHIP_MISMATCH] Registering new session');
          const newId = await this.registerSession({
            userId,
            userType,
            sessionToken: newToken,
            ipAddress,
            userAgent,
            expiresAt
          });
          return newId;
        }
      }

      if (!session && userId !== undefined && userType !== undefined) {
        logger.info({ sessionId, userId, userType }, '[SESSION_NOT_FOUND] Registering new session');
        const newId = await this.registerSession({
          userId,
          userType,
          sessionToken: newToken,
          ipAddress,
          userAgent,
          expiresAt
        });
        return newId;
      }

      if (session) {
        await db
          .update(userSessions)
          .set({ is_current: false })
          .where(and(
            eq(userSessions.user_id, session.user_id),
            eq(userSessions.user_type, session.user_type),
            ne(userSessions.id, sessionId)
          ));
      }

      await db
        .update(userSessions)
        .set({
          session_token_hash: sessionTokenHash,
          browser: deviceInfo.browser,
          operating_system: deviceInfo.operatingSystem,
          ip_address: ipAddress,
          last_seen_at: lastSeenAt,
          expires_at: expiryDate,
          is_current: true
        })
        .where(eq(userSessions.id, sessionId));

      logger.info({ sessionId, ipAddress }, '[SESSION_UPDATED]');
      return true;
    } catch (err) {
      logger.error(err, '[SESSION_UPDATE_FAILED]');
      return false;
    }
  }
}

export default SecurityService;

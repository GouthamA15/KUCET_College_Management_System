/**
 * KUCET CMS Canonical Real-Time Event Definitions and Room Mappings
 *
 * All real-time events in KUCET CMS follow a standardized taxonomy:
 * - resource:action (e.g. admission:created, request:updated)
 * - Legacy uppercase aliases supported for backward compatibility (e.g. ADMISSION_DRAFT_CREATED)
 */

export const REALTIME_EVENTS = Object.freeze({
  // --- Student Admissions ---
  ADMISSION_CREATED: 'admission:created',
  ADMISSION_UPDATED: 'admission:updated',
  ADMISSION_STATUS_CHANGED: 'admission:status-changed',
  ADMISSION_FINALIZED: 'admission:finalized',
  ADMISSION_DELETED: 'admission:deleted',

  // --- Administrative & Clerk Requests ---
  REQUEST_CREATED: 'request:created',
  REQUEST_UPDATED: 'request:updated',
  REQUEST_STATUS_CHANGED: 'request:status-changed',
  REQUEST_COMPLETED: 'request:completed',

  // --- Staff Management ---
  STAFF_CREATED: 'staff:created',
  STAFF_UPDATED: 'staff:updated',
  STAFF_STATUS_CHANGED: 'staff:status-changed',
  STAFF_REGISTRATION_CREATED: 'staff:registration:created',

  // --- Student Management & Profile ---
  STUDENT_CREATED: 'student:created',
  STUDENT_UPDATED: 'student:updated',
  STUDENT_PHOTO_UPDATED: 'student:photo:updated',
  STUDENT_PHOTO_REMOVED: 'student:photo:removed',
  STUDENT_STATS_UPDATED: 'student:stats:updated',

  // --- Academics & Attendance ---
  TIMETABLE_CHANGED: 'academic:timetable:changed',
  SESSION_STARTED: 'attendance:session:started',
  SESSION_ENDED: 'attendance:session:ended',
  ATTENDANCE_SAVED: 'attendance:saved',
  STUDENT_VERIFIED: 'attendance:student:verified',
  PROXY_ATTEMPTED: 'attendance:proxy:attempted',
  STUDENT_LOCKED: 'attendance:student:locked',

  // --- Notifications & Security ---
  NOTIFICATION_CREATED: 'notification:created',
  SECURITY_EVENT: 'security:event',
  SESSION_REVOKED: 'session:revoked',
});

/**
 * Standardized Room Namespaces
 */
export const REALTIME_ROOMS = Object.freeze({
  ADMIN: 'role:admin',
  STAFF: 'role:staff',
  FACULTY: 'role:faculty',
  ADMISSION: 'role:admission',
  SCHOLARSHIP: 'role:scholarship',
  STUDENT: 'role:student',
  userAdmin: (adminId) => `user:admin:${adminId}`,
  userStaff: (staffId) => `user:staff:${staffId}`,
  userStudent: (studentId) => `user:student:${studentId}`,
  studentRoll: (rollNo) => `student:${rollNo}`,
  dept: (branchCode) => `dept:${branchCode?.toUpperCase()}`,
});

/**
 * Maps legacy event names to canonical event names
 */
export function normalizeEventName(event) {
  const legacyMap = {
    ADMISSION_DRAFT_CREATED: REALTIME_EVENTS.ADMISSION_CREATED,
    ADMISSION_DRAFT_UPDATED: REALTIME_EVENTS.ADMISSION_UPDATED,
    ADMISSION_DRAFT_FINALIZED: REALTIME_EVENTS.ADMISSION_FINALIZED,
    ADMISSION_DRAFT_DELETED: REALTIME_EVENTS.ADMISSION_DELETED,
    REQUEST_CREATED: REALTIME_EVENTS.REQUEST_CREATED,
    REQUEST_UPDATED: REALTIME_EVENTS.REQUEST_UPDATED,
    STAFF_CREATED: REALTIME_EVENTS.STAFF_CREATED,
    STAFF_UPDATED: REALTIME_EVENTS.STAFF_UPDATED,
    STAFF_STATUS_CHANGED: REALTIME_EVENTS.STAFF_STATUS_CHANGED,
    STAFF_REGISTRATION_CREATED: REALTIME_EVENTS.STAFF_REGISTRATION_CREATED,
    PROFILE_PHOTO_UPDATED: REALTIME_EVENTS.STUDENT_PHOTO_UPDATED,
    PROFILE_PHOTO_REMOVED: REALTIME_EVENTS.STUDENT_PHOTO_REMOVED,
    TIMETABLE_CHANGED: REALTIME_EVENTS.TIMETABLE_CHANGED,
    SESSION_STARTED: REALTIME_EVENTS.SESSION_STARTED,
    SESSION_ENDED: REALTIME_EVENTS.SESSION_ENDED,
    ATTENDANCE_SAVED: REALTIME_EVENTS.ATTENDANCE_SAVED,
    STUDENT_VERIFIED: REALTIME_EVENTS.STUDENT_VERIFIED,
    PROXY_ATTEMPTED: REALTIME_EVENTS.PROXY_ATTEMPTED,
    STUDENT_LOCKED: REALTIME_EVENTS.STUDENT_LOCKED,
    SECURITY_NOTIFICATION_CREATED: REALTIME_EVENTS.NOTIFICATION_CREATED,
    SESSION_REVOKED: REALTIME_EVENTS.SESSION_REVOKED,
  };

  return legacyMap[event] || event;
}

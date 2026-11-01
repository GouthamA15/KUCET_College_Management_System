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

  // --- Mind Sports & Chess ---
  CHESS_MOVE_PLAYED: 'chess:move:played',
  CHESS_GAME_OVER: 'chess:game:over',
  CHESS_ACTION: 'chess:action',
  TOURNAMENT_UPDATED: 'tournament:updated',
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
  matchRoom: (matchId) => `match:${matchId}`,
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

/**
 * Resolves recipient room names for an event and payload to ensure strict room isolation.
 * Prevents unintentional broadcast to unrelated users when callers don't provide explicit rooms.
 *
 * @param {string} event - The raw or canonical event name
 * @param {Object} [payload={}] - Event payload containing metadata (e.g. roll_no, student_id, branch, role)
 * @param {Object} [options={}] - Publishing options (e.g. { room, rooms, isPublic, broadcastAll })
 * @returns {string[]} Array of target room names
 */
export function resolveEventRooms(event, payload = {}, options = {}) {
  // If rooms explicitly specified, respect them directly
  if (Array.isArray(options.rooms) && options.rooms.length > 0) {
    return Array.from(new Set(options.rooms.filter(Boolean)));
  }
  if (options.room) {
    return [options.room];
  }
  if (options.isPublic || options.broadcastAll) {
    return [];
  }

  const canonical = normalizeEventName(event);
  const rooms = new Set();

  switch (canonical) {
    // --- Admissions ---
    case REALTIME_EVENTS.ADMISSION_CREATED:
    case REALTIME_EVENTS.ADMISSION_UPDATED:
    case REALTIME_EVENTS.ADMISSION_FINALIZED:
    case REALTIME_EVENTS.ADMISSION_DELETED:
    case REALTIME_EVENTS.ADMISSION_STATUS_CHANGED:
      rooms.add(REALTIME_ROOMS.ADMIN);
      rooms.add(REALTIME_ROOMS.ADMISSION);
      rooms.add('channel:admissions');
      if (payload.student_id) rooms.add(REALTIME_ROOMS.userStudent(payload.student_id));
      if (payload.roll_no) rooms.add(REALTIME_ROOMS.studentRoll(payload.roll_no));
      break;

    // --- Administrative & Clerk Requests ---
    case REALTIME_EVENTS.REQUEST_CREATED:
    case REALTIME_EVENTS.REQUEST_UPDATED:
    case REALTIME_EVENTS.REQUEST_STATUS_CHANGED:
    case REALTIME_EVENTS.REQUEST_COMPLETED:
      rooms.add(REALTIME_ROOMS.ADMIN);
      rooms.add('channel:requests');
      if (payload.staffType) {
        rooms.add(`role:${payload.staffType.toLowerCase()}`);
      }
      if (payload.role) {
        rooms.add(`role:${payload.role.toLowerCase()}`);
      }
      if (payload.student_id) rooms.add(REALTIME_ROOMS.userStudent(payload.student_id));
      if (payload.roll_no) rooms.add(REALTIME_ROOMS.studentRoll(payload.roll_no));
      break;

    // --- Staff Management ---
    case REALTIME_EVENTS.STAFF_REGISTRATION_CREATED:
      rooms.add(REALTIME_ROOMS.ADMIN);
      rooms.add('channel:staff');
      break;

    case REALTIME_EVENTS.STAFF_CREATED:
    case REALTIME_EVENTS.STAFF_UPDATED:
    case REALTIME_EVENTS.STAFF_STATUS_CHANGED:
      rooms.add(REALTIME_ROOMS.ADMIN);
      rooms.add('channel:staff');
      if (payload.id || payload.staffId) {
        rooms.add(REALTIME_ROOMS.userStaff(payload.id || payload.staffId));
      }
      if (payload.branch) {
        rooms.add(REALTIME_ROOMS.dept(payload.branch));
      }
      break;

    // --- Student Management & Profile ---
    case REALTIME_EVENTS.STUDENT_CREATED:
    case REALTIME_EVENTS.STUDENT_UPDATED:
    case REALTIME_EVENTS.STUDENT_PHOTO_UPDATED:
    case REALTIME_EVENTS.STUDENT_PHOTO_REMOVED:
    case REALTIME_EVENTS.STUDENT_STATS_UPDATED:
      rooms.add(REALTIME_ROOMS.ADMIN);
      rooms.add('channel:students');
      if (payload.student_id) rooms.add(REALTIME_ROOMS.userStudent(payload.student_id));
      if (payload.roll_no) rooms.add(REALTIME_ROOMS.studentRoll(payload.roll_no));
      break;

    case 'PROFILE_UPDATE_REQUESTED':
      rooms.add(REALTIME_ROOMS.ADMIN);
      rooms.add('channel:requests');
      if (payload.student_id) rooms.add(REALTIME_ROOMS.userStudent(payload.student_id));
      if (payload.roll_no) rooms.add(REALTIME_ROOMS.studentRoll(payload.roll_no));
      break;

    // --- Academics & Timetable ---
    case REALTIME_EVENTS.TIMETABLE_CHANGED:
      rooms.add(REALTIME_ROOMS.ADMIN);
      if (payload.branch && payload.branch !== 'ALL') {
        rooms.add(REALTIME_ROOMS.dept(payload.branch));
      } else {
        rooms.add(REALTIME_ROOMS.STAFF);
        rooms.add(REALTIME_ROOMS.STUDENT);
      }
      break;

    // --- Attendance ---
    case REALTIME_EVENTS.SESSION_STARTED:
    case REALTIME_EVENTS.SESSION_ENDED:
      rooms.add(REALTIME_ROOMS.ADMIN);
      if (payload.branch) {
        rooms.add(REALTIME_ROOMS.dept(payload.branch));
      }
      break;

    case REALTIME_EVENTS.ATTENDANCE_SAVED:
      rooms.add(REALTIME_ROOMS.ADMIN);
      if (payload.branch) {
        rooms.add(REALTIME_ROOMS.dept(payload.branch));
      }
      if (payload.faculty_id || payload.staff_id) {
        rooms.add(REALTIME_ROOMS.userStaff(payload.faculty_id || payload.staff_id));
      }
      break;

    case REALTIME_EVENTS.STUDENT_VERIFIED:
    case REALTIME_EVENTS.PROXY_ATTEMPTED:
    case REALTIME_EVENTS.STUDENT_LOCKED:
      rooms.add(REALTIME_ROOMS.ADMIN);
      if (payload.student_id) rooms.add(REALTIME_ROOMS.userStudent(payload.student_id));
      if (payload.roll_no) rooms.add(REALTIME_ROOMS.studentRoll(payload.roll_no));
      if (payload.branch) rooms.add(REALTIME_ROOMS.dept(payload.branch));
      break;

    // --- Notifications & Security ---
    case REALTIME_EVENTS.NOTIFICATION_CREATED:
    case REALTIME_EVENTS.SECURITY_EVENT:
      rooms.add(REALTIME_ROOMS.ADMIN);
      if (payload.student_id) rooms.add(REALTIME_ROOMS.userStudent(payload.student_id));
      if (payload.roll_no) rooms.add(REALTIME_ROOMS.studentRoll(payload.roll_no));
      if (payload.staff_id) rooms.add(REALTIME_ROOMS.userStaff(payload.staff_id));
      if (payload.user_id && payload.role) {
        rooms.add(`user:${payload.role}:${payload.user_id}`);
      }
      break;

    case REALTIME_EVENTS.SESSION_REVOKED:
      if (payload.student_id) rooms.add(REALTIME_ROOMS.userStudent(payload.student_id));
      if (payload.roll_no) rooms.add(REALTIME_ROOMS.studentRoll(payload.roll_no));
      if (payload.staff_id) rooms.add(REALTIME_ROOMS.userStaff(payload.staff_id));
      if (payload.user_id && payload.role) {
        rooms.add(`user:${payload.role}:${payload.user_id}`);
      }
      break;

    // --- Mind Sports / Chess ---
    case REALTIME_EVENTS.CHESS_MOVE_PLAYED:
    case REALTIME_EVENTS.CHESS_GAME_OVER:
    case REALTIME_EVENTS.CHESS_ACTION:
      if (payload.matchId || payload.match_id) {
        rooms.add(REALTIME_ROOMS.matchRoom(payload.matchId || payload.match_id));
      }
      if (payload.player_white_user_id) {
        rooms.add(REALTIME_ROOMS.studentRoll(payload.player_white_user_id));
      }
      if (payload.player_black_user_id) {
        rooms.add(REALTIME_ROOMS.studentRoll(payload.player_black_user_id));
      }
      break;

    default:
      // If payload contains targeted identity, include those rooms
      if (payload.student_id) rooms.add(REALTIME_ROOMS.userStudent(payload.student_id));
      if (payload.roll_no) rooms.add(REALTIME_ROOMS.studentRoll(payload.roll_no));
      if (payload.staff_id || payload.staffId) rooms.add(REALTIME_ROOMS.userStaff(payload.staff_id || payload.staffId));
      if (payload.branch) rooms.add(REALTIME_ROOMS.dept(payload.branch));
      break;
  }

  return Array.from(rooms);
}


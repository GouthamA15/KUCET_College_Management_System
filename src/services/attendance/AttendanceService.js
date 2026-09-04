import { db } from '@/db';
import { 
  attendanceSessions, 
  facultySubjectAssignments, 
  facultySubstitutions 
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * Service for Attendance-related business logic
 */
export class AttendanceService {
  /**
   * Update or set topic covered for an attendance lecture session
   * @param {Object} params
   * @param {number} params.assignmentId
   * @param {string} params.date YYYY-MM-DD
   * @param {number} params.sessionNumber 1-8
   * @param {string|null} params.topicCovered Text up to 500 chars
   * @param {Object} params.user Authenticated staff/faculty user
   */
  static async updateLectureTopic({ assignmentId, date, sessionNumber, topicCovered, user }) {
    if (!user || (user.role !== 'faculty' && user.role !== 'admin')) {
      throw new Error('Unauthorized');
    }

    // 1. Verify assignment existence
    const [assignment] = await db.select({
      id: facultySubjectAssignments.id,
      branch: facultySubjectAssignments.branch,
      faculty_id: facultySubjectAssignments.staff_account_id
    })
    .from(facultySubjectAssignments)
    .where(eq(facultySubjectAssignments.id, assignmentId))
    .limit(1);

    if (!assignment) {
      throw new Error('Assignment not found');
    }

    // 2. Authorization check
    let isAuthorized = false;
    if (user.role === 'admin' || assignment.faculty_id === user.id) {
      isAuthorized = true;
    } else if (user.is_hod && user.branch === assignment.branch) {
      isAuthorized = true;
    } else {
      const [substitution] = await db.select()
        .from(facultySubstitutions)
        .where(and(
          eq(facultySubstitutions.original_assignment_id, assignmentId),
          eq(facultySubstitutions.substitute_faculty_id, user.id),
          eq(facultySubstitutions.substitution_date, date)
        ))
        .limit(1);
      if (substitution) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      throw new Error('Unauthorized to modify lecture topics for this assignment');
    }

    // 3. Normalize topic_covered
    if (!topicCovered || typeof topicCovered !== 'string' || topicCovered.trim().length < 2) {
      throw new Error('Topic covered is required (minimum 2 characters)');
    }
    const normalizedTopic = topicCovered.trim().slice(0, 500);

    // 4. Find existing session or create session metadata row
    const [existingSession] = await db.select({ id: attendanceSessions.id })
      .from(attendanceSessions)
      .where(and(
        eq(attendanceSessions.assignment_id, assignmentId),
        eq(attendanceSessions.attendance_date, date),
        eq(attendanceSessions.session_number, sessionNumber)
      ))
      .limit(1);

    if (existingSession) {
      await db.update(attendanceSessions)
        .set({ topic_covered: normalizedTopic })
        .where(eq(attendanceSessions.id, existingSession.id));
    } else {
      await db.insert(attendanceSessions).values({
        assignment_id: assignmentId,
        attendance_date: date,
        session_number: sessionNumber,
        faculty_id: user.id,
        session_pin: '0000',
        session_token: crypto.randomBytes(16).toString('hex'),
        is_active: false,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year expiry for session metadata
        topic_covered: normalizedTopic
      });
    }

    return {
      success: true,
      message: 'Lecture topic updated successfully',
      topic_covered: normalizedTopic
    };
  }

  /**
   * Fetch all topics for a given assignment
   * @param {number} assignmentId
   */
  static async getLectureTopicsForAssignment(assignmentId) {
    const sessions = await db.select({
      id: attendanceSessions.id,
      date: attendanceSessions.attendance_date,
      session: attendanceSessions.session_number,
      topic_covered: attendanceSessions.topic_covered
    })
    .from(attendanceSessions)
    .where(eq(attendanceSessions.assignment_id, assignmentId));

    return sessions;
  }
}

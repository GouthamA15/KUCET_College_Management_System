import { eventDb, quizQuestions, quizSessions, quizAnswers, eventAuditLogs, initExperimentDb } from '../db';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { EventConfigService } from './EventConfigService';
import logger from '@/lib/logger';
import crypto from 'crypto';

export class QuizService {
  /**
   * Retrieves the Technical Quiz event config and rules.
   */
  static async getQuizConfig(eventKey = 'quiz') {
    await initExperimentDb();
    const config = await EventConfigService.getEventConfig(eventKey);
    return config;
  }

  /**
   * Updates quiz settings (duration, rules, toggles).
   */
  static async updateQuizConfig(configData, updatedBy = 'ADMIN', eventKey = 'quiz') {
    return await EventConfigService.updateEventConfig(eventKey, configData, updatedBy);
  }

  /**
   * Returns list of quiz questions.
   * SECURITY INVARIANT: Non-admin calls MUST strip `correct_option_index` and `explanation`.
   */
  static async getQuestions({ isAdmin = false, eventKey = 'quiz', activeOnly = true } = {}) {
    await initExperimentDb();

    let query = eventDb.select().from(quizQuestions);
    const conditions = [eq(quizQuestions.event_key, eventKey)];
    if (activeOnly) {
      conditions.push(eq(quizQuestions.is_active, true));
    }

    const rows = await query
      .where(and(...conditions))
      .orderBy(asc(quizQuestions.question_order), asc(quizQuestions.id));

    return rows.map((q) => {
      let options = q.options_json;
      if (typeof options === 'string') {
        try {
          options = JSON.parse(options);
        } catch (_e) {
          options = [];
        }
      }

      const formatted = {
        id: q.id,
        event_key: q.event_key,
        question_text: q.question_text,
        options,
        marks: parseFloat(q.marks) || 1,
        negative_marks: parseFloat(q.negative_marks) || 0,
        category: q.category,
        difficulty: q.difficulty,
        question_order: q.question_order,
        is_active: Boolean(q.is_active),
        created_at: q.created_at,
      };

      if (isAdmin) {
        formatted.correct_option_index = q.correct_option_index;
        formatted.explanation = q.explanation;
      }

      return formatted;
    });
  }

  /**
   * Admin: Creates a new question in the question bank.
   */
  static async createQuestion(data, createdBy = 'ADMIN', eventKey = 'quiz') {
    await initExperimentDb();

    if (!data.question_text || typeof data.question_text !== 'string' || !data.question_text.trim()) {
      throw new Error('Question text is required.');
    }

    const options = Array.isArray(data.options) ? data.options : [];
    if (options.length < 2) {
      throw new Error('At least 2 options are required for a multiple choice question.');
    }

    const correctIndex = parseInt(data.correct_option_index, 10);
    if (isNaN(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
      throw new Error(`Valid correct option index (0 to ${options.length - 1}) is required.`);
    }

    const marks = parseFloat(data.marks) || 1.0;
    const negativeMarks = parseFloat(data.negative_marks) || 0.0;
    const category = data.category?.trim() || 'Computer Science';
    const difficulty = ['EASY', 'MEDIUM', 'HARD'].includes(data.difficulty) ? data.difficulty : 'MEDIUM';
    const order = parseInt(data.question_order, 10) || 0;
    const explanation = data.explanation?.trim() || null;

    const [result] = await eventDb.insert(quizQuestions).values({
      event_key: eventKey,
      question_text: data.question_text.trim(),
      options_json: options,
      correct_option_index: correctIndex,
      explanation,
      marks: marks.toFixed(2),
      negative_marks: negativeMarks.toFixed(2),
      category,
      difficulty,
      question_order: order,
      is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
    });

    await eventDb.insert(eventAuditLogs).values({
      event_key: eventKey,
      action: 'CREATE_QUESTION',
      actor_id: String(createdBy),
      actor_type: 'ADMIN',
      target_id: String(result.insertId),
      target_type: 'QUIZ_QUESTION',
      details: { question_text: data.question_text.substring(0, 80), category, marks },
    });

    return { id: result.insertId, message: 'Question created successfully' };
  }

  /**
   * Admin: Updates an existing question.
   */
  static async updateQuestion(questionId, data, updatedBy = 'ADMIN', eventKey = 'quiz') {
    await initExperimentDb();

    const qId = parseInt(questionId, 10);
    const existing = await eventDb.query.quizQuestions.findFirst({
      where: eq(quizQuestions.id, qId),
    });

    if (!existing) {
      throw new Error('Question not found');
    }

    const updatePayload = { updated_at: new Date() };

    if (data.question_text !== undefined) updatePayload.question_text = data.question_text.trim();
    if (data.options !== undefined && Array.isArray(data.options)) {
      if (data.options.length < 2) throw new Error('At least 2 options required.');
      updatePayload.options_json = data.options;
    }
    if (data.correct_option_index !== undefined) {
      const cIdx = parseInt(data.correct_option_index, 10);
      updatePayload.correct_option_index = cIdx;
    }
    if (data.explanation !== undefined) updatePayload.explanation = data.explanation?.trim() || null;
    if (data.marks !== undefined) updatePayload.marks = parseFloat(data.marks).toFixed(2);
    if (data.negative_marks !== undefined) updatePayload.negative_marks = parseFloat(data.negative_marks).toFixed(2);
    if (data.category !== undefined) updatePayload.category = data.category.trim();
    if (data.difficulty !== undefined) updatePayload.difficulty = data.difficulty;
    if (data.question_order !== undefined) updatePayload.question_order = parseInt(data.question_order, 10) || 0;
    if (data.is_active !== undefined) updatePayload.is_active = Boolean(data.is_active);

    await eventDb.update(quizQuestions).set(updatePayload).where(eq(quizQuestions.id, qId));

    await eventDb.insert(eventAuditLogs).values({
      event_key: eventKey,
      action: 'UPDATE_QUESTION',
      actor_id: String(updatedBy),
      actor_type: 'ADMIN',
      target_id: String(qId),
      target_type: 'QUIZ_QUESTION',
      details: { changes: updatePayload },
    });

    return { message: 'Question updated successfully' };
  }

  /**
   * Admin: Deletes a question.
   */
  static async deleteQuestion(questionId, deletedBy = 'ADMIN', eventKey = 'quiz') {
    await initExperimentDb();
    const qId = parseInt(questionId, 10);

    await eventDb.delete(quizQuestions).where(eq(quizQuestions.id, qId));

    await eventDb.insert(eventAuditLogs).values({
      event_key: eventKey,
      action: 'DELETE_QUESTION',
      actor_id: String(deletedBy),
      actor_type: 'ADMIN',
      target_id: String(qId),
      target_type: 'QUIZ_QUESTION',
      details: { deleted_question_id: qId },
    });

    return { message: 'Question deleted successfully' };
  }

  /**
   * Starts a new quiz session or resumes an existing in-progress session.
   */
  static async startOrResumeSession({
    userId,
    userType = 'student',
    displayName,
    department = null,
    email = null,
    ipAddress = null,
    userAgent = null,
    eventKey = 'quiz',
  }) {
    await initExperimentDb();

    if (!userId || !displayName) {
      throw new Error('User ID and Display Name are required to start the quiz.');
    }

    const config = await this.getQuizConfig(eventKey);
    const rules = config.rules_json || {};
    const durationMinutes = parseInt(rules.duration_minutes, 10) || 15;
    const maxAttempts = parseInt(rules.max_attempts_per_user, 10) || 1;

    // Check existing sessions for this user
    const existingSessions = await eventDb.query.quizSessions.findMany({
      where: and(
        eq(quizSessions.event_key, eventKey),
        eq(quizSessions.user_id, String(userId))
      ),
      orderBy: [desc(quizSessions.id)],
    });

    // 1. Check if there's an active in-progress session
    const activeSession = existingSessions.find((s) => s.status === 'IN_PROGRESS');
    if (activeSession) {
      const now = new Date();
      const expiresAt = new Date(activeSession.expires_at);

      // If already expired, auto-submit/finalize
      if (now > expiresAt) {
        logger.info({ sessionId: activeSession.id, userId }, '[QUIZ_SESSION_EXPIRED_ON_RESUME]');
        return await this.submitQuiz({
          sessionCode: activeSession.session_code,
          userId,
          isAutoExpire: true,
          eventKey,
        });
      }

      // Session is active: fetch questions (sanitized) and candidate's saved answers
      const questions = await this.getQuestions({ isAdmin: false, eventKey, activeOnly: true });
      const savedAnswers = await eventDb.query.quizAnswers.findMany({
        where: eq(quizAnswers.session_id, activeSession.id),
      });

      const answersMap = {};
      savedAnswers.forEach((ans) => {
        answersMap[ans.question_id] = {
          selected_option_index: ans.selected_option_index,
          is_marked_for_review: Boolean(ans.is_marked_for_review),
        };
      });

      const remainingSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));

      return {
        session: activeSession,
        questions,
        savedAnswers: answersMap,
        remainingSeconds,
        isResumed: true,
      };
    }

    // 2. Check max attempts constraint
    const submittedCount = existingSessions.filter((s) => ['SUBMITTED', 'EXPIRED'].includes(s.status)).length;
    if (submittedCount >= maxAttempts) {
      const lastSession = existingSessions[0];
      return {
        isCompleted: true,
        session: lastSession,
        message: 'You have already completed your quiz attempt.',
      };
    }

    // 3. Create fresh new session
    const questions = await this.getQuestions({ isAdmin: false, eventKey, activeOnly: true });
    if (questions.length === 0) {
      throw new Error('No active quiz questions found. Please contact the tournament administrator.');
    }

    const totalQuestions = questions.length;
    const maxPossibleScore = questions.reduce((sum, q) => sum + (parseFloat(q.marks) || 1), 0);

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + durationMinutes * 60 * 1000);
    const sessionCode = `QUIZ-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const [inserted] = await eventDb.insert(quizSessions).values({
      event_key: eventKey,
      session_code: sessionCode,
      user_id: String(userId),
      user_type: userType,
      display_name: displayName,
      department,
      email,
      status: 'IN_PROGRESS',
      total_questions: totalQuestions,
      total_attempted: 0,
      total_correct: 0,
      total_incorrect: 0,
      total_unanswered: totalQuestions,
      score: '0.00',
      max_possible_score: maxPossibleScore.toFixed(2),
      percentage: '0.00',
      started_at: startedAt,
      expires_at: expiresAt,
      time_taken_seconds: 0,
      ip_address: ipAddress,
      user_agent: userAgent ? userAgent.substring(0, 500) : null,
    });

    const newSession = await eventDb.query.quizSessions.findFirst({
      where: eq(quizSessions.id, inserted.insertId),
    });

    logger.info({ sessionId: inserted.insertId, sessionCode, userId }, '[QUIZ_SESSION_STARTED]');

    return {
      session: newSession,
      questions,
      savedAnswers: {},
      remainingSeconds: durationMinutes * 60,
      isResumed: false,
    };
  }

  /**
   * Autosaves candidate answer for a specific question during test taking.
   */
  static async saveAnswer({
    sessionCode,
    userId,
    questionId,
    selectedOptionIndex,
    isMarkedForReview = false,
    timeSpentSeconds = 0,
    eventKey = 'quiz',
  }) {
    await initExperimentDb();

    const session = await eventDb.query.quizSessions.findFirst({
      where: and(
        eq(quizSessions.session_code, sessionCode),
        eq(quizSessions.user_id, String(userId))
      ),
    });

    if (!session) {
      throw new Error('Invalid quiz session');
    }

    if (session.status !== 'IN_PROGRESS') {
      return { success: false, status: session.status, message: 'Session is no longer in progress.' };
    }

    const now = new Date();
    // Allow 15 seconds grace window for network lag
    if (now.getTime() > new Date(session.expires_at).getTime() + 15000) {
      await this.submitQuiz({ sessionCode, userId, isAutoExpire: true, eventKey });
      return { success: false, status: 'EXPIRED', message: 'Time limit expired.' };
    }

    const qId = parseInt(questionId, 10);
    const optionIdx = selectedOptionIndex === null || selectedOptionIndex === undefined ? null : parseInt(selectedOptionIndex, 10);

    // Upsert into quiz_answers
    await eventDb
      .insert(quizAnswers)
      .values({
        session_id: session.id,
        question_id: qId,
        selected_option_index: optionIdx,
        is_marked_for_review: Boolean(isMarkedForReview),
        time_spent_seconds: parseInt(timeSpentSeconds, 10) || 0,
        answered_at: new Date(),
      })
      .onDuplicateKeyUpdate({
        set: {
          selected_option_index: optionIdx,
          is_marked_for_review: Boolean(isMarkedForReview),
          time_spent_seconds: parseInt(timeSpentSeconds, 10) || 0,
          answered_at: new Date(),
          updated_at: new Date(),
        },
      });

    return { success: true };
  }

  /**
   * Evaluates answers, calculates final score with negative marking, and seals the session.
   * SERVER-AUTHORITATIVE: Scoring is strictly computed against the DB correct answer keys.
   */
  static async submitQuiz({
    sessionCode,
    userId,
    submittedAnswers = null,
    isAutoExpire = false,
    eventKey = 'quiz',
  }) {
    await initExperimentDb();

    const session = await eventDb.query.quizSessions.findFirst({
      where: and(
        eq(quizSessions.session_code, sessionCode),
        eq(quizSessions.user_id, String(userId))
      ),
    });

    if (!session) {
      throw new Error('Quiz session not found.');
    }

    // If already submitted, return the completed scorecard
    if (session.status === 'SUBMITTED' || session.status === 'EXPIRED') {
      const fullReview = await this.getSessionScorecard(session.id);
      return {
        alreadySubmitted: true,
        session,
        scorecard: fullReview,
      };
    }

    // 1. Fetch all active questions with correct keys for server evaluation
    const allQuestions = await eventDb.query.quizQuestions.findMany({
      where: and(
        eq(quizQuestions.event_key, eventKey),
        eq(quizQuestions.is_active, true)
      ),
      orderBy: [asc(quizQuestions.question_order), asc(quizQuestions.id)],
    });

    // 2. Fetch all saved answers in DB
    const savedAnswers = await eventDb.query.quizAnswers.findMany({
      where: eq(quizAnswers.session_id, session.id),
    });

    const answersMap = new Map();
    savedAnswers.forEach((ans) => {
      answersMap.set(ans.question_id, ans);
    });

    // If candidate passed an in-flight submission map, merge it
    if (submittedAnswers && typeof submittedAnswers === 'object') {
      Object.entries(submittedAnswers).forEach(([qIdStr, val]) => {
        const qId = parseInt(qIdStr, 10);
        const existing = answersMap.get(qId) || {
          session_id: session.id,
          question_id: qId,
          time_spent_seconds: 0,
        };
        const opt = val?.selected_option_index !== undefined ? val.selected_option_index : (typeof val === 'number' ? val : null);
        answersMap.set(qId, {
          ...existing,
          selected_option_index: opt === null || opt === undefined ? null : parseInt(opt, 10),
          is_marked_for_review: Boolean(val?.is_marked_for_review),
        });
      });
    }

    // 3. Evaluate each question
    let totalCorrect = 0;
    let totalIncorrect = 0;
    let totalUnanswered = 0;
    let totalAttempted = 0;
    let totalScore = 0.0;
    let maxPossibleScore = 0.0;

    const answerEvaluations = [];

    for (const q of allQuestions) {
      const qMarks = parseFloat(q.marks) || 1.0;
      const qNegative = parseFloat(q.negative_marks) || 0.0;
      maxPossibleScore += qMarks;

      const userAns = answersMap.get(q.id);
      const selectedIndex = userAns?.selected_option_index;

      let isCorrect = false;
      let marksAwarded = 0.0;

      if (selectedIndex === null || selectedIndex === undefined) {
        totalUnanswered += 1;
        marksAwarded = 0.0;
      } else {
        totalAttempted += 1;
        if (selectedIndex === q.correct_option_index) {
          isCorrect = true;
          totalCorrect += 1;
          marksAwarded = qMarks;
          totalScore += qMarks;
        } else {
          isCorrect = false;
          totalIncorrect += 1;
          marksAwarded = -qNegative;
          totalScore -= qNegative;
        }
      }

      answerEvaluations.push({
        session_id: session.id,
        question_id: q.id,
        selected_option_index: selectedIndex !== null && selectedIndex !== undefined ? selectedIndex : null,
        is_marked_for_review: Boolean(userAns?.is_marked_for_review),
        is_correct: isCorrect,
        marks_awarded: marksAwarded.toFixed(2),
        time_spent_seconds: userAns?.time_spent_seconds || 0,
        answered_at: new Date(),
      });
    }

    // Ensure score doesn't fall below zero if required, or keep raw
    const finalScore = Math.max(0, totalScore);
    const percentage = maxPossibleScore > 0 ? (finalScore / maxPossibleScore) * 100 : 0.0;

    const submittedAt = new Date();
    const startedAt = new Date(session.started_at);
    const timeTakenSeconds = Math.max(1, Math.round((submittedAt.getTime() - startedAt.getTime()) / 1000));

    // 4. Update or batch upsert quiz answers with evaluated marks
    for (const evalAns of answerEvaluations) {
      await eventDb
        .insert(quizAnswers)
        .values(evalAns)
        .onDuplicateKeyUpdate({
          set: {
            selected_option_index: evalAns.selected_option_index,
            is_correct: evalAns.is_correct,
            marks_awarded: evalAns.marks_awarded,
            updated_at: new Date(),
          },
        });
    }

    // 5. Update session record
    const finalStatus = isAutoExpire ? 'EXPIRED' : 'SUBMITTED';
    await eventDb
      .update(quizSessions)
      .set({
        status: finalStatus,
        total_questions: allQuestions.length,
        total_attempted: totalAttempted,
        total_correct: totalCorrect,
        total_incorrect: totalIncorrect,
        total_unanswered: totalUnanswered,
        score: finalScore.toFixed(2),
        max_possible_score: maxPossibleScore.toFixed(2),
        percentage: percentage.toFixed(2),
        submitted_at: submittedAt,
        time_taken_seconds: timeTakenSeconds,
        updated_at: new Date(),
      })
      .where(eq(quizSessions.id, session.id));

    // 6. Audit Log
    await eventDb.insert(eventAuditLogs).values({
      event_key: eventKey,
      action: isAutoExpire ? 'AUTO_EXPIRE_QUIZ' : 'SUBMIT_QUIZ',
      actor_id: String(userId),
      actor_type: 'STUDENT',
      target_id: String(session.id),
      target_type: 'QUIZ_SESSION',
      details: {
        score: finalScore.toFixed(2),
        percentage: percentage.toFixed(2),
        total_correct: totalCorrect,
        time_taken_seconds: timeTakenSeconds,
      },
    });

    logger.info(
      { sessionId: session.id, userId, finalScore, totalCorrect, timeTakenSeconds },
      '[QUIZ_SUBMITTED_SUCCESS]'
    );

    const scorecard = await this.getSessionScorecard(session.id);

    return {
      success: true,
      status: finalStatus,
      scorecard,
    };
  }

  /**
   * Retrieves full detailed scorecard for a completed session.
   */
  static async getSessionScorecard(sessionId) {
    await initExperimentDb();
    const sId = parseInt(sessionId, 10);

    const session = await eventDb.query.quizSessions.findFirst({
      where: eq(quizSessions.id, sId),
    });

    if (!session) return null;

    const questions = await eventDb.query.quizQuestions.findMany({
      where: and(
        eq(quizQuestions.event_key, session.event_key),
        eq(quizQuestions.is_active, true)
      ),
      orderBy: [asc(quizQuestions.question_order), asc(quizQuestions.id)],
    });

    const answers = await eventDb.query.quizAnswers.findMany({
      where: eq(quizAnswers.session_id, sId),
    });

    const answersMap = new Map();
    answers.forEach((a) => answersMap.set(a.question_id, a));

    const breakdown = questions.map((q) => {
      let options = q.options_json;
      if (typeof options === 'string') {
        try {
          options = JSON.parse(options);
        } catch (_e) {
          options = [];
        }
      }
      const ans = answersMap.get(q.id);
      return {
        question_id: q.id,
        question_text: q.question_text,
        options,
        category: q.category,
        marks: parseFloat(q.marks) || 1,
        negative_marks: parseFloat(q.negative_marks) || 0,
        selected_option_index: ans?.selected_option_index ?? null,
        correct_option_index: q.correct_option_index,
        is_correct: ans?.is_correct ?? false,
        marks_awarded: parseFloat(ans?.marks_awarded) || 0.0,
        explanation: q.explanation,
      };
    });

    return {
      session,
      breakdown,
    };
  }

  /**
   * Returns live leaderboard ranked deterministically:
   * Rank 1: Highest Score DESC
   * Tie-breaker 1: Lowest Time Taken ASC
   * Tie-breaker 2: Earliest Submission ASC
   */
  static async getLeaderboard({ eventKey = 'quiz', limit = 100 } = {}) {
    await initExperimentDb();

    const rows = await eventDb
      .select({
        id: quizSessions.id,
        session_code: quizSessions.session_code,
        user_id: quizSessions.user_id,
        user_type: quizSessions.user_type,
        display_name: quizSessions.display_name,
        department: quizSessions.department,
        score: quizSessions.score,
        max_possible_score: quizSessions.max_possible_score,
        percentage: quizSessions.percentage,
        total_correct: quizSessions.total_correct,
        total_questions: quizSessions.total_questions,
        time_taken_seconds: quizSessions.time_taken_seconds,
        submitted_at: quizSessions.submitted_at,
        status: quizSessions.status,
      })
      .from(quizSessions)
      .where(
        and(
          eq(quizSessions.event_key, eventKey),
          sql`${quizSessions.status} IN ('SUBMITTED', 'EXPIRED')`
        )
      )
      .orderBy(
        desc(quizSessions.score),
        asc(quizSessions.time_taken_seconds),
        asc(quizSessions.submitted_at)
      )
      .limit(limit);

    return rows.map((entry, index) => ({
      rank: index + 1,
      ...entry,
      score: parseFloat(entry.score) || 0,
      max_possible_score: parseFloat(entry.max_possible_score) || 0,
      percentage: parseFloat(entry.percentage) || 0,
    }));
  }

  /**
   * Admin: Retrieves all sessions with filtering & stats.
   */
  static async getAdminSessions({ eventKey = 'quiz', status = null, search = '' } = {}) {
    await initExperimentDb();

    let query = eventDb.select().from(quizSessions);
    const conditions = [eq(quizSessions.event_key, eventKey)];

    if (status) {
      conditions.push(eq(quizSessions.status, status));
    }

    const rows = await query
      .where(and(...conditions))
      .orderBy(desc(quizSessions.id));

    let filtered = rows;
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = rows.filter(
        (r) =>
          r.display_name?.toLowerCase().includes(q) ||
          r.user_id?.toLowerCase().includes(q) ||
          r.department?.toLowerCase().includes(q)
      );
    }

    return filtered.map((s) => ({
      ...s,
      score: parseFloat(s.score) || 0,
      max_possible_score: parseFloat(s.max_possible_score) || 0,
      percentage: parseFloat(s.percentage) || 0,
    }));
  }

  /**
   * Admin: Resets a student's session (e.g. for re-attempt after connectivity issue).
   */
  static async resetSession(sessionId, adminId = 'ADMIN', eventKey = 'quiz') {
    await initExperimentDb();
    const sId = parseInt(sessionId, 10);

    const session = await eventDb.query.quizSessions.findFirst({
      where: eq(quizSessions.id, sId),
    });

    if (!session) throw new Error('Session not found');

    // Delete associated answers
    await eventDb.delete(quizAnswers).where(eq(quizAnswers.session_id, sId));
    // Delete session
    await eventDb.delete(quizSessions).where(eq(quizSessions.id, sId));

    await eventDb.insert(eventAuditLogs).values({
      event_key: eventKey,
      action: 'RESET_STUDENT_SESSION',
      actor_id: String(adminId),
      actor_type: 'ADMIN',
      target_id: String(sId),
      target_type: 'QUIZ_SESSION',
      details: { reset_user_id: session.user_id, session_code: session.session_code },
    });

    return { message: `Session for ${session.display_name} (${session.user_id}) reset successfully.` };
  }
}

export default QuizService;

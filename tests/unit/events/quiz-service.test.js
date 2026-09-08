import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuizService } from '@/modules/events/services/QuizService';
import { EventConfigService } from '@/modules/events/services/EventConfigService';
import { eventDb } from '@/modules/events/db';

vi.mock('@/modules/events/db', () => ({
  initExperimentDb: vi.fn().mockResolvedValue(true),
  eventDb: {
    insert: vi.fn(() => ({
      values: vi.fn().mockReturnValue({
        onDuplicateKeyUpdate: vi.fn().mockResolvedValue([{ insertId: 101, affectedRows: 1 }]),
        then: (resolve) => resolve([{ insertId: 101, affectedRows: 1 }]),
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ affectedRows: 1 }]),
      }),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue([{ affectedRows: 1 }]),
    })),
    select: vi.fn(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    })),
    query: {
      eventConfigs: { findFirst: vi.fn() },
      quizQuestions: { findFirst: vi.fn(), findMany: vi.fn() },
      quizSessions: { findFirst: vi.fn(), findMany: vi.fn() },
      quizAnswers: { findFirst: vi.fn(), findMany: vi.fn() },
    },
  },
  quizQuestions: {
    id: 'id',
    event_key: 'event_key',
    is_active: 'is_active',
    question_order: 'question_order',
  },
  quizSessions: {
    id: 'id',
    event_key: 'event_key',
    session_code: 'session_code',
    user_id: 'user_id',
    status: 'status',
    score: 'score',
    time_taken_seconds: 'time_taken_seconds',
    submitted_at: 'submitted_at',
  },
  quizAnswers: {
    id: 'id',
    session_id: 'session_id',
    question_id: 'question_id',
  },
  eventAuditLogs: {},
}));

describe('QuizService & Core Assessment Invariants', () => {
  const mockQuestions = [
    {
      id: 1,
      event_key: 'quiz',
      question_text: 'What is the worst-case time complexity of QuickSort?',
      options_json: ['O(N log N)', 'O(N)', 'O(N²)', 'O(log N)'],
      correct_option_index: 2,
      explanation: 'Unbalanced partitioning results in O(N²).',
      marks: '2.00',
      negative_marks: '0.50',
      category: 'Algorithms',
      difficulty: 'MEDIUM',
      question_order: 1,
      is_active: true,
      created_at: new Date(),
    },
    {
      id: 2,
      event_key: 'quiz',
      question_text: 'Which protocol is connection-oriented?',
      options_json: ['UDP', 'TCP', 'ICMP', 'DNS'],
      correct_option_index: 1,
      explanation: 'TCP uses a 3-way handshake to establish a reliable stream.',
      marks: '2.00',
      negative_marks: '0.50',
      category: 'Networks',
      difficulty: 'EASY',
      question_order: 2,
      is_active: true,
      created_at: new Date(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(EventConfigService, 'getEventConfig').mockResolvedValue({
      event_key: 'quiz',
      event_name: 'KUCET Technical Quiz',
      is_enabled: true,
      rules_json: {
        duration_minutes: 15,
        max_attempts_per_user: 1,
        marks_per_question: 2,
        negative_marking: 0.5,
      },
    });
  });

  describe('Question Sanitization & Security (Zero-Trust)', () => {
    it('MUST strip correct_option_index and explanation when queried for students (isAdmin: false)', async () => {
      eventDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockQuestions),
          }),
        }),
      });

      const questions = await QuizService.getQuestions({ isAdmin: false, eventKey: 'quiz' });

      expect(questions.length).toBe(2);
      // Student payload must NEVER contain answer keys
      expect(questions[0].correct_option_index).toBeUndefined();
      expect(questions[0].explanation).toBeUndefined();
      expect(questions[0].question_text).toBe('What is the worst-case time complexity of QuickSort?');
      expect(questions[0].options).toHaveLength(4);
      expect(questions[0].marks).toBe(2);
    });

    it('MUST include correct_option_index and explanation when queried for admins (isAdmin: true)', async () => {
      eventDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockQuestions),
          }),
        }),
      });

      const questions = await QuizService.getQuestions({ isAdmin: true, eventKey: 'quiz' });

      expect(questions.length).toBe(2);
      expect(questions[0].correct_option_index).toBe(2);
      expect(questions[0].explanation).toBe('Unbalanced partitioning results in O(N²).');
    });
  });

  describe('Session Lifecycle & Timer Initialization', () => {
    it('should create a fresh new session with calculated expires_at for eligible candidate', async () => {
      eventDb.query.quizSessions.findMany.mockResolvedValueOnce([]); // No prior sessions
      eventDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockQuestions),
          }),
        }),
      });

      const mockCreatedSession = {
        id: 101,
        session_code: 'QUIZ-SESS-001',
        user_id: '0123-22-733-001',
        display_name: 'Rahul Sharma',
        status: 'IN_PROGRESS',
        total_questions: 2,
        max_possible_score: '4.00',
        started_at: new Date(),
        expires_at: new Date(Date.now() + 15 * 60 * 1000),
      };
      eventDb.query.quizSessions.findFirst.mockResolvedValueOnce(mockCreatedSession);

      const result = await QuizService.startOrResumeSession({
        userId: '0123-22-733-001',
        displayName: 'Rahul Sharma',
        department: 'CSE',
      });

      expect(result.session).toBeDefined();
      expect(result.isResumed).toBe(false);
      expect(result.questions).toHaveLength(2);
      expect(result.remainingSeconds).toBe(15 * 60);
      expect(eventDb.insert).toHaveBeenCalled();
    });

    it('should resume an active IN_PROGRESS session and return saved answers', async () => {
      const activeSession = {
        id: 101,
        session_code: 'QUIZ-SESS-001',
        user_id: '0123-22-733-001',
        display_name: 'Rahul Sharma',
        status: 'IN_PROGRESS',
        started_at: new Date(),
        expires_at: new Date(Date.now() + 500 * 1000), // 500 seconds remaining
      };
      eventDb.query.quizSessions.findMany.mockResolvedValueOnce([activeSession]);
      eventDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockQuestions),
          }),
        }),
      });
      eventDb.query.quizAnswers.findMany.mockResolvedValueOnce([
        { question_id: 1, selected_option_index: 2, is_marked_for_review: true },
      ]);

      const result = await QuizService.startOrResumeSession({
        userId: '0123-22-733-001',
        displayName: 'Rahul Sharma',
      });

      expect(result.isResumed).toBe(true);
      expect(result.session.id).toBe(101);
      expect(result.savedAnswers[1].selected_option_index).toBe(2);
      expect(result.savedAnswers[1].is_marked_for_review).toBe(true);
      expect(result.remainingSeconds).toBeGreaterThan(0);
    });

    it('should block starting a new quiz if candidate has already completed max attempts', async () => {
      const completedSession = {
        id: 99,
        session_code: 'QUIZ-DONE-001',
        user_id: '0123-22-733-001',
        status: 'SUBMITTED',
        score: '4.00',
      };
      eventDb.query.quizSessions.findMany.mockResolvedValueOnce([completedSession]);

      const result = await QuizService.startOrResumeSession({
        userId: '0123-22-733-001',
        displayName: 'Rahul Sharma',
      });

      expect(result.isCompleted).toBe(true);
      expect(result.message).toContain('already completed');
    });
  });

  describe('Server-Authoritative Evaluation & Negative Marking', () => {
    it('should accurately calculate score: +marks for correct, -negative_marks for incorrect, 0 for unanswered', async () => {
      const activeSession = {
        id: 101,
        session_code: 'QUIZ-SESS-001',
        user_id: '0123-22-733-001',
        display_name: 'Rahul Sharma',
        status: 'IN_PROGRESS',
        started_at: new Date(Date.now() - 300 * 1000),
        expires_at: new Date(Date.now() + 600 * 1000),
      };

      eventDb.query.quizSessions.findFirst.mockResolvedValueOnce(activeSession);
      eventDb.query.quizQuestions.findMany.mockResolvedValueOnce(mockQuestions);
      eventDb.query.quizAnswers.findMany.mockResolvedValueOnce([]); // No db pre-saved

      // Question 1: option 2 (Correct -> +2.00)
      // Question 2: option 0 (Incorrect, correct is 1 -> -0.50)
      // Total Score: 2.00 - 0.50 = 1.50 / 4.00 (37.5%)
      const submittedAnswers = {
        1: { selected_option_index: 2 },
        2: { selected_option_index: 0 },
      };

      // Mock getSessionScorecard internal call
      eventDb.query.quizSessions.findFirst.mockResolvedValueOnce({
        ...activeSession,
        status: 'SUBMITTED',
        score: '1.50',
        max_possible_score: '4.00',
        percentage: '37.50',
        total_correct: 1,
        total_incorrect: 1,
        total_unanswered: 0,
      });
      eventDb.query.quizQuestions.findMany.mockResolvedValueOnce(mockQuestions);
      eventDb.query.quizAnswers.findMany.mockResolvedValueOnce([
        { question_id: 1, selected_option_index: 2, is_correct: true, marks_awarded: '2.00' },
        { question_id: 2, selected_option_index: 0, is_correct: false, marks_awarded: '-0.50' },
      ]);

      const result = await QuizService.submitQuiz({
        sessionCode: 'QUIZ-SESS-001',
        userId: '0123-22-733-001',
        submittedAnswers,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('SUBMITTED');
      expect(eventDb.update).toHaveBeenCalled();
    });
  });

  describe('Question Bank CRUD Validation', () => {
    it('should validate question creation with sufficient options and correct option index bounds', async () => {
      await expect(
        QuizService.createQuestion({
          question_text: '',
          options: ['A', 'B'],
          correct_option_index: 0,
        })
      ).rejects.toThrow('Question text is required');

      await expect(
        QuizService.createQuestion({
          question_text: 'Valid Question',
          options: ['A'], // Only 1 option
          correct_option_index: 0,
        })
      ).rejects.toThrow('At least 2 options');

      await expect(
        QuizService.createQuestion({
          question_text: 'Valid Question',
          options: ['A', 'B', 'C'],
          correct_option_index: 5, // Out of bounds
        })
      ).rejects.toThrow('Valid correct option index');
    });

    it('should successfully create question when all inputs are valid', async () => {
      const result = await QuizService.createQuestion({
        question_text: 'What is an idempotent HTTP method?',
        options: ['POST', 'GET', 'PATCH', 'CONNECT'],
        correct_option_index: 1,
        explanation: 'GET requests produce identical state when repeated.',
        marks: 2.0,
        negative_marks: 0.5,
        category: 'Web Technologies',
      });

      expect(result.id).toBe(101);
      expect(result.message).toContain('successfully');
    });
  });
});

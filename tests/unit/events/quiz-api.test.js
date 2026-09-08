import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getQuizConfig, PUT as putQuizConfig } from '@/app/api/events/quiz/config/route';
import { GET as getQuestions, POST as postQuestions } from '@/app/api/events/quiz/questions/route';
import { GET as getSession, POST as postSession } from '@/app/api/events/quiz/session/route';
import { POST as postSaveAnswer } from '@/app/api/events/quiz/save-answer/route';
import { POST as postSubmit } from '@/app/api/events/quiz/submit/route';
import { GET as getLeaderboard } from '@/app/api/events/quiz/leaderboard/route';
import { QuizService } from '@/modules/events/services/QuizService';
import { EventConfigService } from '@/modules/events/services/EventConfigService';
import { ParticipantService } from '@/modules/events/services/ParticipantService';
import { verifyJwt } from '@/lib/auth';
import { cookies, headers } from 'next/headers';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  verifyJwt: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    runWithContext: vi.fn((ctx, fn) => fn()),
  },
}));

const makeMockRequest = (url = 'http://localhost/api/events/quiz/config', method = 'GET', body = null) => {
  return {
    url,
    method,
    json: async () => body,
    headers: {
      get: () => null,
    },
  };
};

describe('Technical Quiz API Routes Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET & PUT /api/events/quiz/config', () => {
    it('should return quiz config on GET', async () => {
      vi.spyOn(QuizService, 'getQuizConfig').mockResolvedValue({
        event_key: 'quiz',
        event_name: 'KUCET Technical Symposium Quiz',
        is_enabled: true,
      });

      const req = makeMockRequest('http://localhost/api/events/quiz/config');
      const res = await getQuizConfig(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.is_enabled).toBe(true);
    });

    it('should allow admin to update quiz rules and toggle on PUT', async () => {
      cookies.mockResolvedValue({
        get: vi.fn((name) => (name === 'admin_auth' ? { value: 'admin-token' } : undefined)),
      });
      headers.mockResolvedValue({ get: vi.fn(() => null) });
      verifyJwt.mockResolvedValue({ id: 1, email: 'admin@kucet.ac.in', role: 'admin' });

      vi.spyOn(QuizService, 'updateQuizConfig').mockResolvedValue({
        event_key: 'quiz',
        is_enabled: true,
        rules_json: { duration_minutes: 20 },
      });

      const req = makeMockRequest('http://localhost/api/events/quiz/config', 'PUT', {
        is_enabled: true,
        rules_json: { duration_minutes: 20 },
      });

      const res = await putQuizConfig(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.is_enabled).toBe(true);
    });
  });

  describe('GET & POST /api/events/quiz/questions', () => {
    it('should return sanitized questions for student GET requests', async () => {
      vi.spyOn(QuizService, 'getQuestions').mockResolvedValue([
        {
          id: 1,
          question_text: 'What is QuickSort complexity?',
          options: ['A', 'B', 'C', 'D'],
          marks: 2,
        },
      ]);

      const req = makeMockRequest('http://localhost/api/events/quiz/questions');
      const res = await getQuestions(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.questions).toHaveLength(1);
      expect(data.questions[0].correct_option_index).toBeUndefined();
    });

    it('should allow admin to create a new question on POST', async () => {
      cookies.mockResolvedValue({
        get: vi.fn((name) => (name === 'admin_auth' ? { value: 'admin-token' } : undefined)),
      });
      headers.mockResolvedValue({ get: vi.fn(() => null) });
      verifyJwt.mockResolvedValue({ id: 1, email: 'admin@kucet.ac.in', role: 'admin' });

      vi.spyOn(QuizService, 'createQuestion').mockResolvedValue({
        id: 10,
        message: 'Question created successfully',
      });

      const req = makeMockRequest('http://localhost/api/events/quiz/questions', 'POST', {
        question_text: 'Which protocol is connection-oriented?',
        options: ['UDP', 'TCP', 'IP', 'HTTP'],
        correct_option_index: 1,
        marks: 2,
        negative_marks: 0.5,
        category: 'Networks',
      });

      const res = await postQuestions(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBe(10);
    });
  });

  describe('POST /api/events/quiz/session', () => {
    it('should block session creation if quiz is disabled', async () => {
      cookies.mockResolvedValue({
        get: vi.fn((name) => (name === 'student_auth' ? { value: 'student-token' } : undefined)),
      });
      headers.mockResolvedValue({ get: vi.fn(() => null) });
      verifyJwt.mockResolvedValue({ id: 1, roll_no: '24567T0901', role: 'student' });

      vi.spyOn(EventConfigService, 'getEventConfig').mockResolvedValue({
        event_key: 'quiz',
        is_enabled: false,
      });

      const req = makeMockRequest('http://localhost/api/events/quiz/session', 'POST', {
        event_key: 'quiz',
      });

      const res = await postSession(req);
      expect(res.status).toBe(403);
    });

    it('should start or resume session when quiz is enabled', async () => {
      cookies.mockResolvedValue({
        get: vi.fn((name) => (name === 'student_auth' ? { value: 'student-token' } : undefined)),
      });
      headers.mockResolvedValue({ get: vi.fn(() => null) });
      verifyJwt.mockResolvedValue({ id: 1, roll_no: '24567T0901', role: 'student', name: 'Rahul' });

      vi.spyOn(EventConfigService, 'getEventConfig').mockResolvedValue({
        event_key: 'quiz',
        is_enabled: true,
      });

      vi.spyOn(ParticipantService, 'resolveAuthoritativeUser').mockResolvedValue({
        userId: '24567T0901',
        displayName: 'Rahul',
        department: 'CSE',
        userType: 'STUDENT',
        email: 'rahul@kucet.ac.in',
      });

      vi.spyOn(ParticipantService, 'registerParticipant').mockResolvedValue({
        id: 1,
        user_id: '24567T0901',
        status: 'ACCEPTED',
      });

      vi.spyOn(QuizService, 'startOrResumeSession').mockResolvedValue({
        session: { id: 1, session_code: 'QUIZ-001', status: 'IN_PROGRESS' },
        questions: [{ id: 1, question_text: 'Sample Q' }],
        remainingSeconds: 900,
        isResumed: false,
      });

      const req = makeMockRequest('http://localhost/api/events/quiz/session', 'POST', {
        event_key: 'quiz',
      });

      const res = await postSession(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.session.session_code).toBe('QUIZ-001');
    });
    it('should reject unauthenticated GET /api/events/quiz/session with 401', async () => {
      cookies.mockResolvedValue({ get: vi.fn(() => undefined) });
      const req = makeMockRequest('http://localhost/api/events/quiz/session?session_code=QUIZ-001', 'GET');
      const res = await getSession(req);
      expect(res.status).toBe(401);
    });

    it('should reject IDOR on GET /api/events/quiz/session when student queries another user', async () => {
      cookies.mockResolvedValue({
        get: vi.fn((name) => (name === 'student_auth' ? { value: 'student-token' } : undefined)),
      });
      headers.mockResolvedValue({ get: vi.fn(() => null) });
      verifyJwt.mockResolvedValue({ id: 1, roll_no: '24567T0901', role: 'student' });
      vi.spyOn(ParticipantService, 'resolveAuthoritativeUser').mockResolvedValue({
        userId: '24567T0901',
        displayName: 'Rahul',
        department: 'CSE',
        userType: 'student',
      });

      const req = makeMockRequest('http://localhost/api/events/quiz/session?session_code=QUIZ-001&user_id=24567T0999', 'GET');
      const res = await getSession(req);
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/events/quiz/save-answer', () => {
    it('should reject unauthenticated POST /api/events/quiz/save-answer with 401', async () => {
      cookies.mockResolvedValue({ get: vi.fn(() => undefined) });
      const req = makeMockRequest('http://localhost/api/events/quiz/save-answer', 'POST', {
        session_code: 'QUIZ-001',
        user_id: '24567T0901',
        question_id: 1,
        selected_option_index: 2,
      });
      const res = await postSaveAnswer(req);
      expect(res.status).toBe(401);
    });

    it('should reject IDOR attempt when candidate tries to save answer for another user', async () => {
      cookies.mockResolvedValue({
        get: vi.fn((name) => (name === 'student_auth' ? { value: 'student-token' } : undefined)),
      });
      headers.mockResolvedValue({ get: vi.fn(() => null) });
      verifyJwt.mockResolvedValue({ id: 1, roll_no: '24567T0901', role: 'student' });
      vi.spyOn(ParticipantService, 'resolveAuthoritativeUser').mockResolvedValue({
        userId: '24567T0901',
        displayName: 'Rahul',
        department: 'CSE',
        userType: 'student',
      });

      const req = makeMockRequest('http://localhost/api/events/quiz/save-answer', 'POST', {
        session_code: 'QUIZ-001',
        user_id: 'VICTIM_USER_ID',
        question_id: 1,
        selected_option_index: 2,
        is_marked_for_review: false,
      });

      const res = await postSaveAnswer(req);
      expect(res.status).toBe(403);
    });

    it('should autosave candidate answer successfully for authorized user', async () => {
      cookies.mockResolvedValue({
        get: vi.fn((name) => (name === 'student_auth' ? { value: 'student-token' } : undefined)),
      });
      headers.mockResolvedValue({ get: vi.fn(() => null) });
      verifyJwt.mockResolvedValue({ id: 1, roll_no: '24567T0901', role: 'student' });
      vi.spyOn(ParticipantService, 'resolveAuthoritativeUser').mockResolvedValue({
        userId: '24567T0901',
        displayName: 'Rahul',
        department: 'CSE',
        userType: 'student',
      });

      vi.spyOn(QuizService, 'saveAnswer').mockResolvedValue({ success: true });

      const req = makeMockRequest('http://localhost/api/events/quiz/save-answer', 'POST', {
        session_code: 'QUIZ-001',
        user_id: '24567T0901',
        question_id: 1,
        selected_option_index: 2,
        is_marked_for_review: false,
      });

      const res = await postSaveAnswer(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('POST /api/events/quiz/submit', () => {
    it('should reject unauthenticated POST /api/events/quiz/submit with 401', async () => {
      cookies.mockResolvedValue({ get: vi.fn(() => undefined) });
      const req = makeMockRequest('http://localhost/api/events/quiz/submit', 'POST', {
        session_code: 'QUIZ-001',
        user_id: '24567T0901',
      });
      const res = await postSubmit(req);
      expect(res.status).toBe(401);
    });

    it('should reject IDOR attempt when submitting for another candidate', async () => {
      cookies.mockResolvedValue({
        get: vi.fn((name) => (name === 'student_auth' ? { value: 'student-token' } : undefined)),
      });
      headers.mockResolvedValue({ get: vi.fn(() => null) });
      verifyJwt.mockResolvedValue({ id: 1, roll_no: '24567T0901', role: 'student' });
      vi.spyOn(ParticipantService, 'resolveAuthoritativeUser').mockResolvedValue({
        userId: '24567T0901',
        displayName: 'Rahul',
        department: 'CSE',
        userType: 'student',
      });

      const req = makeMockRequest('http://localhost/api/events/quiz/submit', 'POST', {
        session_code: 'QUIZ-001',
        user_id: 'VICTIM_USER_ID',
      });

      const res = await postSubmit(req);
      expect(res.status).toBe(403);
    });

    it('should evaluate and return final scorecard on quiz submission for authorized user', async () => {
      cookies.mockResolvedValue({
        get: vi.fn((name) => (name === 'student_auth' ? { value: 'student-token' } : undefined)),
      });
      headers.mockResolvedValue({ get: vi.fn(() => null) });
      verifyJwt.mockResolvedValue({ id: 1, roll_no: '24567T0901', role: 'student' });
      vi.spyOn(ParticipantService, 'resolveAuthoritativeUser').mockResolvedValue({
        userId: '24567T0901',
        displayName: 'Rahul',
        department: 'CSE',
        userType: 'student',
      });

      vi.spyOn(QuizService, 'submitQuiz').mockResolvedValue({
        success: true,
        status: 'SUBMITTED',
        scorecard: {
          session: { score: '4.00', percentage: '100.00', total_correct: 2 },
          breakdown: [],
        },
      });

      const req = makeMockRequest('http://localhost/api/events/quiz/submit', 'POST', {
        session_code: 'QUIZ-001',
        user_id: '24567T0901',
        submitted_answers: { 1: { selected_option_index: 2 } },
      });

      const res = await postSubmit(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.scorecard.session.score).toBe('4.00');
    });
  });

  describe('GET /api/events/quiz/leaderboard', () => {
    it('should return ranked tournament leaderboard', async () => {
      vi.spyOn(QuizService, 'getLeaderboard').mockResolvedValue([
        { rank: 1, display_name: 'Alice', score: 20, time_taken_seconds: 400 },
        { rank: 2, display_name: 'Bob', score: 18, time_taken_seconds: 350 },
      ]);

      const req = makeMockRequest('http://localhost/api/events/quiz/leaderboard?limit=10');
      const res = await getLeaderboard(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.leaderboard).toHaveLength(2);
      expect(data.leaderboard[0].rank).toBe(1);
    });
  });
});

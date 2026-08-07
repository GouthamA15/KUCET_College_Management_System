import { describe, test, expect, vi, beforeEach } from 'vitest';
import { AssistantService } from '@/services/AssistantService';

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn().mockResolvedValue([])
        }))
      }))
    })),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue({})
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue({})
      }))
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue({})
    }))
  }
}));

vi.mock('@/intelligence/analytics/StudentAnalytics', () => ({
  StudentAnalytics: {
    getStudentSummary: vi.fn().mockResolvedValue({
      attendance: 72.5,
      feeStatus: 'OVERDUE',
      scholarshipStatus: 'SANCTION_PENDING'
    })
  }
}));

vi.mock('@/intelligence/analytics/FacultyAnalytics', () => ({
  FacultyAnalytics: {
    getAttendanceSubmissionRate: vi.fn().mockResolvedValue({ submissionRate: 90, topicCoverage: 75 })
  }
}));

vi.mock('@/intelligence/analytics/DepartmentAnalytics', () => ({
  DepartmentAnalytics: {
    getDepartmentSummary: vi.fn().mockResolvedValue({ avgStudentPerf: 74, feeCollection: 88 })
  }
}));

vi.mock('@/intelligence/analytics/InstitutionAnalytics', () => ({
  InstitutionAnalytics: {
    getInstitutionSummary: vi.fn().mockResolvedValue({ activeStudents: 1240 })
  }
}));

describe('AssistantService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('createConversation creates and returns a conversation object', async () => {
    const conv = await AssistantService.createConversation('STUDENT_1', 'student', 'Test Chat');
    expect(conv.id).toBeDefined();
    expect(conv.user_id).toBe('STUDENT_1');
    expect(conv.role).toBe('student');
    expect(conv.title).toBe('Test Chat');
  });

  test('processChatMessage generates student attendance response', async () => {
    const result = await AssistantService.processChatMessage({
      user: { id: 'STUDENT_1', role: 'student' },
      message: 'Show my attendance summary',
      conversationId: null
    });

    expect(result.conversation_id).toBeDefined();
    expect(result.assistant_message).toBeDefined();
    expect(result.assistant_message.message).toContain('Student Attendance Intelligence Analysis');
    expect(result.assistant_message.message).toContain('72.5%');
  });

  test('processChatMessage generates faculty analytics response', async () => {
    const result = await AssistantService.processChatMessage({
      user: { id: 'FACULTY_1', role: 'faculty' },
      message: 'Show my topic completion rate',
      conversationId: null
    });

    expect(result.assistant_message.message).toContain('Faculty Analytics');
  });

  test('processChatMessage generates HOD department summary response', async () => {
    const result = await AssistantService.processChatMessage({
      user: { id: 'FACULTY_HOD', role: 'faculty', is_hod: true, branch: 'CSE' },
      message: 'Show department performance',
      conversationId: null
    });

    expect(result.assistant_message.message).toContain('Head of Department Intelligence Engine');
    expect(result.assistant_message.message).toContain('CSE Department');
  });

  test('processChatMessage generates admin institution summary response', async () => {
    const result = await AssistantService.processChatMessage({
      user: { id: 'ADMIN_1', role: 'admin' },
      message: 'Show institution KPIs',
      conversationId: null
    });

    expect(result.assistant_message.message).toContain('Super Admin Intelligence Command');
  });
});

/* global describe, test, expect, vi, beforeEach */
import { QueryOptimizer } from '@/intelligence/shared/QueryOptimizer.js';
import { db } from '@/db';

vi.mock('@/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn()
  }
}));

describe('QueryOptimizer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('batchLoadStudents returns Map with correct structure', async () => {
    const mockData = [{ id: 'stu1', name: 'John' }, { id: 'stu2', name: 'Jane' }];
    db.where.mockResolvedValueOnce(mockData);

    const result = await QueryOptimizer.batchLoadStudents(['stu1', 'stu2']);
    
    expect(result).toBeInstanceOf(Map);
    expect(result.get('stu1')).toEqual(mockData[0]);
    expect(result.get('stu2')).toEqual(mockData[1]);
  });

  test('batchLoadAttendance groups by studentId', async () => {
    const mockData = [
      { studentId: 'stu1', status: 'PRESENT' },
      { student_id: 'stu1', status: 'ABSENT' },
      { studentId: 'stu2', status: 'PRESENT' }
    ];
    db.where.mockResolvedValueOnce(mockData);

    const result = await QueryOptimizer.batchLoadAttendance(['stu1', 'stu2']);
    
    expect(result).toBeInstanceOf(Map);
    expect(result.get('stu1').length).toBe(2);
    expect(result.get('stu2').length).toBe(1);
  });

  test('empty input returns empty Map', async () => {
    const result = await QueryOptimizer.batchLoadStudents([]);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    expect(db.select).not.toHaveBeenCalled();
  });
});

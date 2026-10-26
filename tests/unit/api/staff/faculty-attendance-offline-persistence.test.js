import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST as bulkSyncPOST } from '@/app/api/staff/faculty/attendance/bulk-sync/route';
import { getAuthUser } from '@/lib/api-utils';
import { AttendanceService } from '@/services/AttendanceService';
import { db } from '@/db';
import {
  openDB,
  savePendingAttendance,
  getPendingAttendance,
  deletePendingAttendance,
  updatePendingAttendance,
  saveAttendanceDraft,
  getAttendanceDraft,
  getLatestAttendanceDraft,
  clearAttendanceDraft,
  clearAllFacultyDrafts
} from '@/lib/idb-attendance';

vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAuthUser: vi.fn(),
  };
});

vi.mock('@/services/AttendanceService', () => ({
  AttendanceService: {
    updateLectureTopic: vi.fn(),
    validateAttendanceDate: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/academic-utils', () => ({
  isSemesterActive: vi.fn().mockResolvedValue(true),
}));

// In-memory IndexedDB simulation for unit testing idb-attendance.js
function setupInMemoryIDB() {
  const stores = {
    pending_attendance: new Map(),
    attendance_drafts: new Map(),
  };
  let autoInc = 1;

  const mockDB = {
    objectStoreNames: {
      contains: (name) => name in stores,
    },
    createObjectStore: (name) => {
      if (!stores[name]) stores[name] = new Map();
      return {
        createIndex: vi.fn(),
      };
    },
    transaction: (storeNames, mode) => {
      const storeName = Array.isArray(storeNames) ? storeNames[0] : storeNames;
      const targetStore = stores[storeName];

      const tx = {
        objectStore: () => ({
          getAll: () => {
            const req = {
              result: Array.from(targetStore.values()),
              onsuccess: null,
              onerror: null,
            };
            setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 0);
            return req;
          },
          get: (key) => {
            const req = {
              result: targetStore.get(key) || null,
              onsuccess: null,
              onerror: null,
            };
            setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 0);
            return req;
          },
          put: (val) => {
            let key = val.id;
            if (!key && storeName === 'pending_attendance') {
              key = autoInc++;
              val.id = key;
            }
            targetStore.set(key, val);
            const req = { result: key, onsuccess: null, onerror: null };
            setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 0);
            return req;
          },
          add: (val) => {
            let key = val.id;
            if (!key && storeName === 'pending_attendance') {
              key = autoInc++;
              val.id = key;
            }
            targetStore.set(key, val);
            const req = { result: key, onsuccess: null, onerror: null };
            setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 0);
            return req;
          },
          delete: (key) => {
            targetStore.delete(key);
            const req = { onsuccess: null, onerror: null };
            setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 0);
            return req;
          },
        }),
        oncomplete: null,
        onerror: null,
      };

      setTimeout(() => tx.oncomplete && tx.oncomplete(), 5);
      return tx;
    },
  };

  const idb = {
    open: (name, version) => {
      const req = {
        result: mockDB,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      };
      setTimeout(() => {
        if (req.onupgradeneeded) {
          req.onupgradeneeded({ target: req });
        }
        if (req.onsuccess) {
          req.onsuccess({ target: req });
        }
      }, 0);
      return req;
    },
  };

  return { idb, stores };
}

describe('Faculty Attendance Offline Storage & Persistent Drafts Suite', () => {
  let originalWindow;
  let originalIndexedDB;

  beforeEach(() => {
    vi.clearAllMocks();
    originalWindow = global.window;
    originalIndexedDB = global.indexedDB;

    const { idb } = setupInMemoryIDB();
    global.window = {};
    global.indexedDB = idb;
  });

  afterEach(() => {
    global.window = originalWindow;
    global.indexedDB = originalIndexedDB;
  });

  describe('IndexedDB Draft Persistence (Phase 3)', () => {
    it('saves an attendance draft and restores it safely across page reloads', async () => {
      const draft = {
        facultyId: 10,
        assignmentId: 201,
        date: '2026-10-26',
        session: 1,
        topic: 'Graph Theory & Dijkstra',
        statusMap: { 1: 'PRESENT', 2: 'ABSENT', 3: 'PRESENT' },
        dayInfo: { day_type: 'WORKING' },
        dateValidation: { isValid: true, message: null },
        isDirty: true,
      };

      const key = await saveAttendanceDraft(draft);
      expect(key).toBe('10_201_2026-10-26_1');

      // Simulate page reload: retrieve draft
      const restored = await getAttendanceDraft(10, 201, '2026-10-26', 1);
      expect(restored).not.toBeNull();
      expect(restored.topic).toBe('Graph Theory & Dijkstra');
      expect(restored.status_map).toEqual({ 1: 'PRESENT', 2: 'ABSENT', 3: 'PRESENT' });
      expect(restored.is_dirty).toBe(true);
      expect(restored.session).toBe(1);
    });

    it('retrieves the latest draft for an assignment when date is initially null', async () => {
      await saveAttendanceDraft({
        facultyId: 10,
        assignmentId: 201,
        date: '2026-10-20',
        session: 1,
        topic: 'Early Topic',
        statusMap: { 1: 'PRESENT' },
      });

      // Small delay to ensure timestamp difference
      await new Promise((r) => setTimeout(r, 10));

      await saveAttendanceDraft({
        facultyId: 10,
        assignmentId: 201,
        date: '2026-10-26',
        session: 2,
        topic: 'Latest Topic',
        statusMap: { 1: 'PRESENT', 2: 'PRESENT' },
      });

      const latest = await getLatestAttendanceDraft(10, 201);
      expect(latest).not.toBeNull();
      expect(latest.date).toBe('2026-10-26');
      expect(latest.session).toBe(2);
      expect(latest.topic).toBe('Latest Topic');
    });

    it('enforces isolation: faculty A cannot access faculty B drafts', async () => {
      await saveAttendanceDraft({
        facultyId: 10,
        assignmentId: 201,
        date: '2026-10-26',
        session: 1,
        topic: 'Faculty 10 Topic',
        statusMap: { 1: 'PRESENT' },
      });

      // Faculty 12 attempts to read Faculty 10's draft
      const draft = await getAttendanceDraft(12, 201, '2026-10-26', 1);
      expect(draft).toBeNull();
    });

    it('clears draft upon successful persistence to prevent stale restored state', async () => {
      await saveAttendanceDraft({
        facultyId: 10,
        assignmentId: 201,
        date: '2026-10-26',
        session: 1,
        topic: 'Saved Topic',
        statusMap: { 1: 'PRESENT' },
      });

      await clearAttendanceDraft(10, 201, '2026-10-26', 1);
      const afterClear = await getAttendanceDraft(10, 201, '2026-10-26', 1);
      expect(afterClear).toBeNull();
    });
  });

  describe('Offline Queue & Operations (Phase 4)', () => {
    it('enqueues offline attendance with client_op_id and topic_covered', async () => {
      const payload = {
        assignment_id: 201,
        subject_name: 'Operating Systems',
        date: '2026-10-26',
        session: 2,
        topic_covered: 'Page Replacement Algorithms',
        attendance_data: [
          { student_id: 1, status: 'PRESENT' },
          { student_id: 2, status: 'ABSENT' },
        ],
      };

      const opId = await savePendingAttendance(payload);
      expect(opId).toBeDefined();

      const pending = await getPendingAttendance();
      expect(pending.length).toBe(1);
      expect(pending[0].assignment_id).toBe(201);
      expect(pending[0].topic_covered).toBe('Page Replacement Algorithms');
      expect(pending[0].sync_status).toBe('PENDING');
      expect(pending[0].retry_count).toBe(0);
    });

    it('updates existing pending queue item if same assignment, date and session is edited again while offline', async () => {
      await savePendingAttendance({
        assignment_id: 201,
        date: '2026-10-26',
        session: 1,
        topic_covered: 'First Draft Topic',
        attendance_data: [{ student_id: 1, status: 'PRESENT' }],
      });

      // Second offline save on same session
      await savePendingAttendance({
        assignment_id: 201,
        date: '2026-10-26',
        session: 1,
        topic_covered: 'Updated Draft Topic',
        attendance_data: [
          { student_id: 1, status: 'PRESENT' },
          { student_id: 2, status: 'ABSENT' },
        ],
      });

      const pending = await getPendingAttendance();
      expect(pending.length).toBe(1);
      expect(pending[0].topic_covered).toBe('Updated Draft Topic');
      expect(pending[0].attendance_data.length).toBe(2);
    });

    it('deletes pending record after server acknowledges synchronization', async () => {
      const opId = await savePendingAttendance({
        assignment_id: 201,
        date: '2026-10-26',
        session: 1,
        attendance_data: [{ student_id: 1, status: 'PRESENT' }],
      });

      await deletePendingAttendance(opId);
      const remaining = await getPendingAttendance();
      expect(remaining.length).toBe(0);
    });

    it('records retry error metadata when synchronization fails', async () => {
      const opId = await savePendingAttendance({
        assignment_id: 201,
        date: '2026-10-26',
        session: 1,
        attendance_data: [{ student_id: 1, status: 'PRESENT' }],
      });

      await updatePendingAttendance(opId, {
        sync_status: 'FAILED',
        retry_count: 1,
        last_error: 'Semester ended for assignment #201',
      });

      const list = await getPendingAttendance();
      expect(list[0].sync_status).toBe('FAILED');
      expect(list[0].retry_count).toBe(1);
      expect(list[0].last_error).toBe('Semester ended for assignment #201');
    });
  });

  describe('POST /api/staff/faculty/attendance/bulk-sync', () => {
    it('successfully processes offline records including topic_covered', async () => {
      getAuthUser.mockResolvedValue({
        id: 10,
        role: 'faculty',
        branch: 'CSE',
      });

      db.select.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ id: 1, is_active: true }]),
          }),
        }),
      });

      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{
                id: 201,
                subject_code: 'CS301',
                branch: 'CSE',
                course_semester: 5,
                academic_year: '2026-2027',
                faculty_id: 10,
              }]),
              orderBy: () => ({
                limit: () => Promise.resolve([{ id: 201 }]),
              }),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: () => ({
            onDuplicateKeyUpdate: () => Promise.resolve(),
          }),
        }),
      };

      db.transaction.mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      const req = new Request('http://localhost:3000/api/staff/faculty/attendance/bulk-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: [
            {
              id: 'client_op_123',
              assignment_id: 201,
              date: '2026-10-26',
              session: 1,
              topic_covered: 'Disk Scheduling Algorithms',
              attendance_data: [
                { student_id: 1, status: 'PRESENT' },
                { student_id: 2, status: 'ABSENT' },
              ],
            },
          ],
        }),
      });

      const res = await bulkSyncPOST(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.synced_count).toBe(1);
      expect(json.synced_ids).toContain('client_op_123');
      expect(AttendanceService.updateLectureTopic).toHaveBeenCalledWith(
        expect.objectContaining({
          assignmentId: 201,
          date: '2026-10-26',
          sessionNumber: 1,
          topicCovered: 'Disk Scheduling Algorithms',
        })
      );
    });

    it('rejects unauthorized caller with 401 Unauthorized', async () => {
      getAuthUser.mockResolvedValue(null);

      const req = new Request('http://localhost:3000/api/staff/faculty/attendance/bulk-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: [] }),
      });

      const res = await bulkSyncPOST(req);
      expect(res.status).toBe(401);
    });

    it('rejects empty records payload with 400 Bad Request', async () => {
      getAuthUser.mockResolvedValue({ id: 10, role: 'faculty' });

      const req = new Request('http://localhost:3000/api/staff/faculty/attendance/bulk-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: [] }),
      });

      const res = await bulkSyncPOST(req);
      expect(res.status).toBe(400);
    });
  });
});

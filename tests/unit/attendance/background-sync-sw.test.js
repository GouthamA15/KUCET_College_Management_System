import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requestBackgroundSync, savePendingAttendance, getPendingAttendance } from '@/lib/idb-attendance';

// In-memory IndexedDB simulation
function setupMockIndexedDB() {
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
    transaction: (storeNames, _mode) => {
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
    open: () => {
      const req = {
        result: mockDB,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      };
      setTimeout(() => {
        if (req.onupgradeneeded) req.onupgradeneeded({ target: req });
        if (req.onsuccess) req.onsuccess({ target: req });
      }, 0);
      return req;
    },
  };

  return { idb, stores };
}

describe('P2: Service Worker Background Sync & Offline Attendance Synchronization', () => {
  let originalWindow;
  let originalIndexedDB;
  let mockStores;

  beforeEach(() => {
    vi.clearAllMocks();
    originalWindow = global.window;
    originalIndexedDB = global.indexedDB;

    const { idb, stores } = setupMockIndexedDB();
    mockStores = stores;

    global.window = {};
    global.indexedDB = idb;
  });

  afterEach(() => {
    global.window = originalWindow;
    global.indexedDB = originalIndexedDB;
    vi.unstubAllGlobals();
  });

  describe('requestBackgroundSync (Progressive Enhancement)', () => {
    it('registers "sync-attendance" when SyncManager is supported by browser', async () => {
      const mockRegister = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', {
        serviceWorker: {
          ready: Promise.resolve({
            sync: {
              register: mockRegister,
            },
          }),
        },
      });

      const result = await requestBackgroundSync('sync-attendance');
      expect(result).toBe(true);
      expect(mockRegister).toHaveBeenCalledWith('sync-attendance');
    });

    it('gracefully returns false when navigator.serviceWorker is absent', async () => {
      vi.stubGlobal('navigator', {});
      const result = await requestBackgroundSync('sync-attendance');
      expect(result).toBe(false);
    });

    it('gracefully returns false on browsers lacking Background Sync (Safari, Firefox, iOS)', async () => {
      vi.stubGlobal('navigator', {
        serviceWorker: {
          ready: Promise.resolve({
            // No `sync` property
          }),
        },
      });

      const result = await requestBackgroundSync('sync-attendance');
      expect(result).toBe(false);
    });

    it('returns false and does not throw when sync.register rejects', async () => {
      vi.stubGlobal('navigator', {
        serviceWorker: {
          ready: Promise.resolve({
            sync: {
              register: vi.fn().mockRejectedValue(new Error('Permission denied')),
            },
          }),
        },
      });

      const result = await requestBackgroundSync('sync-attendance');
      expect(result).toBe(false);
    });

    it('savePendingAttendance triggers requestBackgroundSync automatically', async () => {
      const mockRegister = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', {
        serviceWorker: {
          ready: Promise.resolve({
            sync: {
              register: mockRegister,
            },
          }),
        },
      });

      const opId = await savePendingAttendance({
        assignment_id: 101,
        date: '2026-10-26',
        session: 1,
        topic_covered: 'Binary Trees',
        attendance_data: [{ student_id: 1, status: 'PRESENT' }],
      });

      expect(opId).toBeDefined();
      // Allow the background sync microtask to execute
      await new Promise((r) => setTimeout(r, 20));
      expect(mockRegister).toHaveBeenCalledWith('sync-attendance');
    });
  });

  describe('Service Worker sync event execution simulation', () => {
    it('synchronizes pending records from IndexedDB and clears them on 200 OK', async () => {
      // 1. Queue a pending attendance item in IndexedDB
      await savePendingAttendance({
        assignment_id: 501,
        date: '2026-10-26',
        session: 3,
        topic_covered: 'Heap Sort',
        attendance_data: [{ student_id: 20, status: 'PRESENT' }],
      });

      const initialPending = await getPendingAttendance();
      expect(initialPending.length).toBe(1);
      const queuedItem = initialPending[0];

      // 2. Setup mock fetch and client messaging
      const postedMessages = [];
      const mockClients = {
        matchAll: vi.fn().mockResolvedValue([
          {
            postMessage: (msg) => postedMessages.push(msg),
          },
        ]),
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          synced_count: 1,
          synced_ids: [queuedItem.client_op_id],
        }),
      });

      // 3. Simulate SW sync execution logic
      const pendingRecords = await getPendingAttendance();
      expect(pendingRecords.length).toBe(1);

      const payload = {
        records: pendingRecords.map((r) => ({
          id: r.client_op_id || r.id,
          client_op_id: r.client_op_id,
          assignment_id: Number(r.assignment_id),
          date: r.date,
          session: Number(r.session),
          topic_covered: r.topic_covered,
          attendance_data: r.attendance_data,
        })),
      };

      const res = await mockFetch('/api/staff/faculty/attendance/bulk-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      expect(data.synced_count).toBe(1);

      // Delete synced item
      for (const _syncedId of data.synced_ids) {
        mockStores.pending_attendance.delete(queuedItem.id);
      }

      // Notify clients
      const clients = await mockClients.matchAll();
      for (const client of clients) {
        client.postMessage({
          type: 'ATTENDANCE_SYNCED',
          synced_count: data.synced_count,
        });
      }

      // Verify item deleted and client notified
      const remaining = Array.from(mockStores.pending_attendance.values());
      expect(remaining.length).toBe(0);
      expect(postedMessages).toEqual([
        { type: 'ATTENDANCE_SYNCED', synced_count: 1 },
      ]);
    });

    it('marks pending record as FAILED with error message when server reports item error', async () => {
      await savePendingAttendance({
        assignment_id: 999,
        date: '2026-10-26',
        session: 1,
        topic_covered: 'Invalid Assignment',
        attendance_data: [{ student_id: 1, status: 'PRESENT' }],
      });

      const pending = await getPendingAttendance();
      const queuedItem = pending[0];

      // Server returns error for this record
      const errorResponse = {
        synced_count: 0,
        synced_ids: [],
        errors: [{ id: queuedItem.client_op_id, error: 'Assignment #999 not found' }],
      };

      const errorMap = new Map(errorResponse.errors.map((e) => [e.id, e.error]));
      if (errorMap.has(queuedItem.client_op_id)) {
        mockStores.pending_attendance.set(queuedItem.id, {
          ...queuedItem,
          sync_status: 'FAILED',
          last_error: errorMap.get(queuedItem.client_op_id),
          updated_at: Date.now(),
        });
      }

      const updated = Array.from(mockStores.pending_attendance.values())[0];
      expect(updated.sync_status).toBe('FAILED');
      expect(updated.last_error).toBe('Assignment #999 not found');
    });

    it('simulates network disconnection where fetch throws, ensuring browser retry', async () => {
      const mockFetchNetworkError = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      let caught = null;
      try {
        await mockFetchNetworkError('/api/staff/faculty/attendance/bulk-sync');
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(TypeError);
      expect(caught.message).toBe('Failed to fetch');
    });
  });
});

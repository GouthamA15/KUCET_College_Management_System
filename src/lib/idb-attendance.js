/**
 * Robust IndexedDB client for Offline Faculty Attendance & Persistent Drafts.
 * Handles:
 * 1. Persistent Attendance Drafts: survives reloads, crashes, and network loss.
 * 2. Durable Pending Sync Queue: queues offline operations with client operation IDs and retry tracking.
 * 3. Graceful fallback in non-browser/SSR environments.
 */

const DB_NAME = 'KUCET_CMS_OFFLINE';
const DB_VERSION = 2;
const PENDING_STORE = 'pending_attendance';
const DRAFT_STORE = 'attendance_drafts';

const isBrowser = () => typeof window !== 'undefined' && typeof indexedDB !== 'undefined';

/**
 * Open or upgrade the offline IndexedDB database
 */
export const openDB = () => {
  return new Promise((resolve, reject) => {
    if (!isBrowser()) {
      return resolve(null);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. Pending sync operations store
      if (!db.objectStoreNames.contains(PENDING_STORE)) {
        const pStore = db.createObjectStore(PENDING_STORE, { keyPath: 'id', autoIncrement: true });
        pStore.createIndex('idx_assignment_date_sess', ['assignment_id', 'date', 'session'], { unique: false });
        pStore.createIndex('idx_client_op_id', 'client_op_id', { unique: false });
        pStore.createIndex('idx_sync_status', 'sync_status', { unique: false });
      }

      // 2. Drafts store for page reloads & browser restarts
      if (!db.objectStoreNames.contains(DRAFT_STORE)) {
        const dStore = db.createObjectStore(DRAFT_STORE, { keyPath: 'id' });
        dStore.createIndex('idx_assignment', 'assignment_id', { unique: false });
        dStore.createIndex('idx_faculty', 'faculty_id', { unique: false });
        dStore.createIndex('idx_updated', 'updated_at', { unique: false });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error || new Error('Failed to open IndexedDB'));
  });
};

// ==========================================
// PENDING ATTENDANCE QUEUE (OFFLINE SYNC)
// ==========================================

/**
 * Request background sync via Service Worker SyncManager if supported.
 * Returns true if registered, false if unsupported or failed.
 */
export const requestBackgroundSync = async (tag = 'sync-attendance') => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    if (registration && 'sync' in registration && typeof registration.sync.register === 'function') {
      await registration.sync.register(tag);
      return true;
    }
  } catch (err) {
    // Non-fatal: background sync is a progressive enhancement. Foreground fallback handles sync.
    console.warn('[SyncManager] Background sync registration skipped:', err?.message || err);
  }
  return false;
};

export const savePendingAttendance = async (payload) => {
  if (!isBrowser()) return null;
  const db = await openDB();
  if (!db) return null;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PENDING_STORE], 'readwrite');
    const store = transaction.objectStore(PENDING_STORE);
    const clientOpId = payload.client_op_id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);

    const recordToSave = {
      ...payload,
      client_op_id: clientOpId,
      topic_covered: typeof payload.topic_covered === 'string' ? payload.topic_covered.trim() : (payload.topic_covered || null),
      sync_status: payload.sync_status || 'PENDING',
      retry_count: payload.retry_count || 0,
      last_error: payload.last_error || null,
      updated_at: Date.now(),
    };

    const request = store.getAll();
    request.onsuccess = () => {
      const all = request.result || [];
      const existing = all.find(item =>
        item.assignment_id === payload.assignment_id &&
        item.date === payload.date &&
        item.session === payload.session
      );

      if (existing) {
        store.put({
          ...recordToSave,
          id: existing.id,
          created_at: existing.created_at || existing.timestamp || Date.now(),
        });
      } else {
        store.add({
          ...recordToSave,
          created_at: Date.now(),
        });
      }
    };

    transaction.oncomplete = () => {
      requestBackgroundSync('sync-attendance').catch(() => {});
      resolve(clientOpId);
    };
    transaction.onerror = (event) => reject(event.target.error);
  });
};

export const getPendingAttendance = async () => {
  if (!isBrowser()) return [];
  const db = await openDB();
  if (!db) return [];

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PENDING_STORE], 'readonly');
    const store = transaction.objectStore(PENDING_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const list = request.result || [];
      list.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
      resolve(list);
    };
    request.onerror = (event) => reject(event.target.error);
  });
};

export const deletePendingAttendance = async (id) => {
  if (!isBrowser()) return;
  const db = await openDB();
  if (!db) return;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PENDING_STORE], 'readwrite');
    const store = transaction.objectStore(PENDING_STORE);

    // If ID is a number, direct delete; if string (client_op_id), find and delete
    if (typeof id === 'number') {
      store.delete(id);
    } else {
      const req = store.getAll();
      req.onsuccess = () => {
        const found = (req.result || []).find(item => item.id === id || item.client_op_id === id);
        if (found) {
          store.delete(found.id);
        }
      };
    }

    transaction.oncomplete = () => resolve();
    transaction.onerror = (event) => reject(event.target.error);
  });
};

export const updatePendingAttendance = async (id, updates) => {
  if (!isBrowser()) return;
  const db = await openDB();
  if (!db) return;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PENDING_STORE], 'readwrite');
    const store = transaction.objectStore(PENDING_STORE);
    const req = store.getAll();

    req.onsuccess = () => {
      const found = (req.result || []).find(item => item.id === id || item.client_op_id === id);
      if (found) {
        store.put({
          ...found,
          ...updates,
          updated_at: Date.now()
        });
      }
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = (event) => reject(event.target.error);
  });
};

// ==========================================
// ATTENDANCE DRAFTS (PERSISTENCE & RECOVERY)
// ==========================================

const buildDraftKey = (facultyId, assignmentId, date, session) => {
  return `${facultyId || 'any'}_${assignmentId}_${date}_${session}`;
};

export const saveAttendanceDraft = async ({
  facultyId = 'any',
  assignmentId,
  date,
  session,
  topic = '',
  statusMap = {},
  dayInfo = null,
  dateValidation = null,
  isDirty = true
}) => {
  if (!isBrowser() || !assignmentId || !date) return null;
  const db = await openDB();
  if (!db) return null;

  const key = buildDraftKey(facultyId, assignmentId, date, session);
  const draftRecord = {
    id: key,
    faculty_id: facultyId,
    assignment_id: assignmentId,
    date,
    session,
    topic: typeof topic === 'string' ? topic : '',
    status_map: statusMap,
    day_info: dayInfo,
    date_validation: dateValidation,
    is_dirty: isDirty,
    updated_at: Date.now()
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DRAFT_STORE], 'readwrite');
    const store = transaction.objectStore(DRAFT_STORE);
    store.put(draftRecord);

    transaction.oncomplete = () => resolve(key);
    transaction.onerror = (event) => reject(event.target.error);
  });
};

export const getAttendanceDraft = async (facultyId = 'any', assignmentId, date, session) => {
  if (!isBrowser() || !assignmentId || !date) return null;
  const db = await openDB();
  if (!db) return null;

  const key = buildDraftKey(facultyId, assignmentId, date, session);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DRAFT_STORE], 'readonly');
    const store = transaction.objectStore(DRAFT_STORE);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = (event) => reject(event.target.error);
  });
};

export const getLatestAttendanceDraft = async (facultyId = 'any', assignmentId) => {
  if (!isBrowser() || !assignmentId) return null;
  const db = await openDB();
  if (!db) return null;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DRAFT_STORE], 'readonly');
    const store = transaction.objectStore(DRAFT_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const all = request.result || [];
      const matches = all.filter(d => 
        String(d.assignment_id) === String(assignmentId) &&
        (facultyId === 'any' || String(d.faculty_id) === String(facultyId) || d.faculty_id === 'any')
      );

      if (matches.length === 0) return resolve(null);
      matches.sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));
      resolve(matches[0]);
    };
    request.onerror = (event) => reject(event.target.error);
  });
};

export const clearAttendanceDraft = async (facultyId = 'any', assignmentId, date, session) => {
  if (!isBrowser() || !assignmentId || !date) return;
  const db = await openDB();
  if (!db) return;

  const key = buildDraftKey(facultyId, assignmentId, date, session);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DRAFT_STORE], 'readwrite');
    const store = transaction.objectStore(DRAFT_STORE);
    store.delete(key);

    transaction.oncomplete = () => resolve();
    transaction.onerror = (event) => reject(event.target.error);
  });
};

export const clearAllFacultyDrafts = async (facultyId) => {
  if (!isBrowser() || !facultyId) return;
  const db = await openDB();
  if (!db) return;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DRAFT_STORE], 'readwrite');
    const store = transaction.objectStore(DRAFT_STORE);
    const req = store.getAll();

    req.onsuccess = () => {
      const all = req.result || [];
      all.forEach(d => {
        if (String(d.faculty_id) === String(facultyId)) {
          store.delete(d.id);
        }
      });
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = (event) => reject(event.target.error);
  });
};
